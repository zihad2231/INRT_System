import { TaskPriority, TaskStatus, TodoStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { TasksService } from './tasks.service.js';

const manager: AuthenticatedUser = {
  id: 'manager-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'manager@example.com',
  fullName: 'Task Manager',
  profileImageUrl: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['ADMIN'],
  permissions: ['TASK_CREATE', 'TASK_MANAGE', 'TASK_VIEW'],
};

const makePrisma = () => ({
  task: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  taskDependency: { findFirst: vi.fn() },
  project: { findFirst: vi.fn() },
  team: { findFirst: vi.fn() },
  user: { findMany: vi.fn() },
  todo: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
});

describe('TasksService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: TasksService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new TasksService(prisma as never);
    prisma.user.findMany.mockResolvedValue([{ id: manager.id }]);
  });

  it('lists tasks in the current organization with supplied filters and pagination', async () => {
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.count.mockResolvedValue(0);

    const result = await service.listTasks(manager, {
      page: 2,
      limit: 10,
      status: TaskStatus.TODO,
    });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          deletedAt: null,
          status: TaskStatus.TODO,
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta.totalPages).toBe(0);
  });

  it('creates task with same-organization assignee and dependency links', async () => {
    prisma.task.findMany.mockResolvedValue([{ id: 'dependency-id', status: TaskStatus.COMPLETED }]);
    prisma.project.findFirst.mockResolvedValue({ id: 'project-id' });
    prisma.user.findMany.mockResolvedValue([{ id: 'member-id' }]);
    prisma.task.create.mockResolvedValue({ id: 'task-id', taskCode: 'T-2' });

    await service.createTask(manager, {
      taskCode: ' T-2 ',
      title: 'Extract paper data',
      projectId: 'project-id',
      assigneeIds: ['member-id'],
      dependsOnTaskIds: ['dependency-id'],
      priority: TaskPriority.HIGH,
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          taskCode: 'T-2',
          createdBy: 'manager-id',
          assignees: { create: [{ userId: 'member-id', assignedBy: 'manager-id' }] },
          dependencies: { create: [{ dependsOnTaskId: 'dependency-id' }] },
        }),
      }),
    );
  });

  it('prevents creating a task before prerequisites are complete', async () => {
    prisma.task.findMany.mockResolvedValue([{ id: 'dependency-id', status: TaskStatus.IN_PROGRESS }]);

    await expect(
      service.createTask(manager, {
        taskCode: 'T-3',
        title: 'Blocked task',
        projectId: 'project-id',
        dependsOnTaskIds: ['dependency-id'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TASK_DEPENDENCY_INCOMPLETE' }),
    });
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('prevents starting a task while a dependency remains incomplete', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: 'task-id', assignees: [{ userId: manager.id }] });
    prisma.taskDependency.findFirst.mockResolvedValue({ id: 'dependency-link' });

    await expect(
      service.updateTaskStatus(manager, 'task-id', { status: TaskStatus.IN_PROGRESS }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TASK_DEPENDENCY_INCOMPLETE' }),
    });
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('marks completion timestamp and forces progress to 100%', async () => {
    prisma.task.findFirst.mockResolvedValue({ id: 'task-id', assignees: [] });
    prisma.task.update.mockResolvedValue({ id: 'task-id', status: TaskStatus.COMPLETED });

    await service.updateTaskStatus(manager, 'task-id', { status: TaskStatus.COMPLETED });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(Date),
          progressPercent: 100,
        }),
      }),
    );
  });

  it('creates an unassigned personal todo for its creator and uses organization scope', async () => {
    prisma.todo.create.mockResolvedValue({ id: 'todo-id' });

    await service.createTodo(manager, { title: 'Contact team lead' });

    expect(prisma.todo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          userId: manager.id,
          createdBy: manager.id,
          priority: TaskPriority.MEDIUM,
        }),
      }),
    );
  });

  it('limits an ordinary user from assigning a todo to another member', async () => {
    const member = { ...manager, roles: ['MEMBER'], permissions: ['TASK_VIEW'] };

    await expect(
      service.createTodo(member, { title: 'Not allowed', userId: 'someone-else' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'TODO_ASSIGN_NOT_ALLOWED' }),
    });
    expect(prisma.todo.create).not.toHaveBeenCalled();
  });

  it('allows assigned todo owner to complete it', async () => {
    prisma.todo.findFirst.mockResolvedValue({ id: 'todo-id', userId: manager.id, createdBy: 'other' });
    prisma.todo.update.mockResolvedValue({ id: 'todo-id', status: TodoStatus.COMPLETED });

    await service.updateTodoStatus(manager, 'todo-id', { status: TodoStatus.COMPLETED });

    expect(prisma.todo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'todo-id' },
        data: { status: TodoStatus.COMPLETED, completedAt: expect.any(Date) },
      }),
    );
  });
});
