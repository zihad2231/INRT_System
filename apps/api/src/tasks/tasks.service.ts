import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TaskPriority,
  TaskStatus,
  TodoStatus,
  UserStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { CreateTodoDto } from './dto/create-todo.dto.js';
import type { ListTasksDto } from './dto/list-tasks.dto.js';
import type { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import type { UpdateTodoStatusDto } from './dto/update-todo-status.dto.js';

const taskInclude = {
  assignees: {
    include: { user: { select: { id: true, memberCode: true, fullName: true } } },
  },
  project: { select: { id: true, projectCode: true, title: true } },
  team: { select: { id: true, teamCode: true, name: true } },
  dependencies: {
    include: { dependsOnTask: { select: { id: true, taskCode: true, title: true, status: true } } },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async listTasks(actor: AuthenticatedUser, query: ListTasksDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.TaskWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.teamId ? { teamId: query.teamId } : {}),
      ...(query.assigneeId ? { assignees: { some: { userId: query.assigneeId } } } : {}),
      ...this.visibilityFilter(actor),
    };
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTask(actor: AuthenticatedUser, dto: CreateTaskDto) {
    this.requirePermission(actor, 'TASK_CREATE');
    if (dto.startDate && dto.dueDate && new Date(dto.dueDate) < new Date(dto.startDate)) {
      throw new BadRequestException({ code: 'INVALID_TASK_DATES', message: 'Due date must be on or after start date.' });
    }

    const assigneeIds = [...new Set(dto.assigneeIds ?? [])];
    const dependencyIds = [...new Set(dto.dependsOnTaskIds ?? [])];
    if (dto.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: {
          id: dto.parentTaskId,
          organizationId: actor.organizationId,
          deletedAt: null,
          ...(dto.projectId ? { projectId: dto.projectId } : {}),
        },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException({ code: 'INVALID_PARENT_TASK', message: 'Parent task must be in the same organization and project.' });
      }
    }
    if (dependencyIds.length) {
      const dependencies = await this.prisma.task.findMany({
        where: {
          id: { in: dependencyIds },
          organizationId: actor.organizationId,
          deletedAt: null,
          ...(dto.projectId ? { projectId: dto.projectId } : {}),
        },
        select: { id: true, status: true },
      });
      if (dependencies.length !== dependencyIds.length) {
        throw new BadRequestException({ code: 'INVALID_TASK_DEPENDENCY', message: 'Dependencies must be existing tasks in the same organization and project.' });
      }
      if (dependencies.some((dependency) => dependency.status !== TaskStatus.COMPLETED)) {
        throw new ConflictException({ code: 'TASK_DEPENDENCY_INCOMPLETE', message: 'A task cannot start until all dependencies are complete.' });
      }
    }

    await this.validateTaskReferences(actor, dto.projectId, dto.teamId, assigneeIds);
    try {
      return await this.prisma.task.create({
        data: {
          organizationId: actor.organizationId,
          taskCode: dto.taskCode.trim(),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          projectId: dto.projectId,
          teamId: dto.teamId,
          createdBy: actor.id,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          parentTaskId: dto.parentTaskId,
          assignees: {
            create: assigneeIds.map((userId) => ({ userId, assignedBy: actor.id })),
          },
          dependencies: {
            create: dependencyIds.map((dependsOnTaskId) => ({ dependsOnTaskId })),
          },
        },
        include: taskInclude,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({ code: 'TASK_CODE_ALREADY_EXISTS', message: 'A task with this code already exists in the organization.' });
      }
      throw error;
    }
  }

  async updateTaskStatus(actor: AuthenticatedUser, taskId: string, dto: UpdateTaskStatusDto) {
    const task = await this.findVisibleTask(actor, taskId);
    const isManager = actor.permissions.includes('TASK_MANAGE');
    const isAssignee = task.assignees.some(({ userId }) => userId === actor.id);
    if (!isManager && !isAssignee) {
      throw new ForbiddenException({ code: 'TASK_UPDATE_NOT_ALLOWED', message: 'Only an assignee or task manager may update this task.' });
    }
    if (dto.status === TaskStatus.IN_PROGRESS) {
      const incomplete = await this.prisma.taskDependency.findFirst({
        where: {
          taskId,
          dependsOnTask: { status: { not: TaskStatus.COMPLETED } },
        },
        select: { id: true },
      });
      if (incomplete) {
        throw new ConflictException({ code: 'TASK_DEPENDENCY_INCOMPLETE', message: 'Complete prerequisite tasks before starting this task.' });
      }
    }

    const completed = dto.status === TaskStatus.COMPLETED;
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: dto.status,
        ...(dto.progressPercent !== undefined ? { progressPercent: dto.progressPercent } : {}),
        ...(completed ? { completedAt: new Date(), progressPercent: 100 } : {}),
        ...(dto.status !== TaskStatus.COMPLETED ? { completedAt: null } : {}),
      },
      include: taskInclude,
    });
  }

  async updateTask(
    actor: AuthenticatedUser,
    taskId: string,
    dto: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      dueDate?: string;
      projectId?: string;
      teamId?: string;
      assigneeIds?: string[];
    },
  ) {
    const task = await this.findVisibleTask(actor, taskId);
    const isManager =
      actor.permissions.includes('TASK_MANAGE') ||
      actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r));
    if (!isManager && task.createdBy !== actor.id) {
      throw new ForbiddenException({
        code: 'TASK_MANAGE_NOT_ALLOWED',
        message: 'Only an Admin or task creator can edit task details.',
      });
    }

    const assigneeIds = dto.assigneeIds ? [...new Set(dto.assigneeIds)] : undefined;
    if (dto.projectId || dto.teamId || assigneeIds) {
      await this.validateTaskReferences(actor, dto.projectId, dto.teamId, assigneeIds ?? []);
    }

    return this.prisma.$transaction(async (tx) => {
      if (assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: assigneeIds.map((userId) => ({ taskId, userId, assignedBy: actor.id })),
          });
        }
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
          ...(dto.projectId !== undefined ? { projectId: dto.projectId || null } : {}),
          ...(dto.teamId !== undefined ? { teamId: dto.teamId || null } : {}),
        },
        include: taskInclude,
      });
    });
  }

  async deleteTask(actor: AuthenticatedUser, taskId: string) {
    const task = await this.findVisibleTask(actor, taskId);
    const isManager =
      actor.permissions.includes('TASK_MANAGE') ||
      actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r));
    if (!isManager && task.createdBy !== actor.id) {
      throw new ForbiddenException({
        code: 'TASK_MANAGE_NOT_ALLOWED',
        message: 'Only an Admin or task creator can delete tasks.',
      });
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });
  }

  async listTodos(actor: AuthenticatedUser, page = 1, limit = 20) {
    const where: Prisma.TodoWhereInput = {
      organizationId: actor.organizationId,
      OR: [
        { userId: actor.id },
        { createdBy: actor.id },
        { team: { members: { some: { userId: actor.id, isActive: true } } } },
        ...(actor.permissions.includes('TASK_MANAGE') ? [{}] : []),
      ],
    };
    const [data, total] = await Promise.all([
      this.prisma.todo.findMany({
        where,
        include: {
          user: { select: { id: true, memberCode: true, fullName: true } },
          team: { select: { id: true, teamCode: true, name: true } },
          project: { select: { id: true, projectCode: true, title: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.todo.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTodo(actor: AuthenticatedUser, dto: CreateTodoDto) {
    const hasManagerPermission = actor.permissions.includes('TASK_MANAGE');
    if ((dto.userId || dto.teamId) && !hasManagerPermission && dto.userId !== actor.id) {
      throw new ForbiddenException({ code: 'TODO_ASSIGN_NOT_ALLOWED', message: 'You cannot assign a to-do to another person or team.' });
    }
    const assigneeId = dto.userId ?? actor.id;
    await this.validateTaskReferences(actor, dto.projectId, dto.teamId, [assigneeId]);
    return this.prisma.todo.create({
      data: {
        organizationId: actor.organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        userId: dto.userId ?? actor.id,
        teamId: dto.teamId,
        projectId: dto.projectId,
        createdBy: actor.id,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        user: { select: { id: true, memberCode: true, fullName: true } },
        team: { select: { id: true, teamCode: true, name: true } },
        project: { select: { id: true, projectCode: true, title: true } },
      },
    });
  }

  async updateTodoStatus(actor: AuthenticatedUser, todoId: string, dto: UpdateTodoStatusDto) {
    const todo = await this.prisma.todo.findFirst({
      where: { id: todoId, organizationId: actor.organizationId },
    });
    if (!todo) throw this.todoNotFound();
    const isAllowed = todo.userId === actor.id || todo.createdBy === actor.id || actor.permissions.includes('TASK_MANAGE');
    if (!isAllowed) throw new ForbiddenException({ code: 'TODO_UPDATE_NOT_ALLOWED', message: 'You cannot update this to-do.' });
    return this.prisma.todo.update({
      where: { id: todoId },
      data: {
        status: dto.status,
        completedAt: dto.status === TodoStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  private async validateTaskReferences(
    actor: AuthenticatedUser,
    projectId: string | undefined,
    teamId: string | undefined,
    userIds: string[],
  ) {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId: actor.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw new BadRequestException({ code: 'INVALID_TASK_PROJECT', message: 'Project is unavailable in this organization.' });
    }
    if (teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: teamId, organizationId: actor.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!team) throw new BadRequestException({ code: 'INVALID_TASK_TEAM', message: 'Team is unavailable in this organization.' });
    }
    if (userIds.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds }, organizationId: actor.organizationId, status: UserStatus.ACTIVE, deletedAt: null },
        select: { id: true },
      });
      if (users.length !== userIds.length) throw new BadRequestException({ code: 'INVALID_TASK_ASSIGNEE', message: 'Assignees must be active users in this organization.' });
    }
  }

  private async findVisibleTask(actor: AuthenticatedUser, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        organizationId: actor.organizationId,
        deletedAt: null,
        ...this.visibilityFilter(actor),
      },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException({ code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
    return task;
  }

  private visibilityFilter(actor: AuthenticatedUser): Prisma.TaskWhereInput {
    if (actor.permissions.includes('TASK_MANAGE') || actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role))) return {};
    return {
      OR: [
        { createdBy: actor.id },
        { assignees: { some: { userId: actor.id } } },
        { team: { members: { some: { userId: actor.id, isActive: true } } } },
        { project: { OR: [{ ownerId: actor.id }, { members: { some: { userId: actor.id } } }] } },
      ],
    };
  }

  private requirePermission(actor: AuthenticatedUser, permission: string) {
    if (!actor.permissions.includes(permission)) {
      throw new ForbiddenException({ code: 'TASK_CREATE_NOT_ALLOWED', message: 'You are not allowed to create tasks.' });
    }
  }

  private todoNotFound() {
    return new NotFoundException({ code: 'TODO_NOT_FOUND', message: 'To-do was not found.' });
  }
}
