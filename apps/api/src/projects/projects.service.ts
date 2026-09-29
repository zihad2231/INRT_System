import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { compare } from 'bcryptjs';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { ListProjectsDto } from './dto/list-projects.dto.js';

const projectSelection = {
  id: true,
  projectCode: true,
  title: true,
  description: true,
  startDate: true,
  targetDate: true,
  status: true,
  progressPercent: true,
  createdAt: true,
  owner: { select: { id: true, memberCode: true, fullName: true, email: true } },
  teams: {
    select: {
      team: {
        select: {
          id: true,
          teamCode: true,
          name: true,
          teamLeader: {
            select: {
              id: true,
              memberCode: true,
              fullName: true,
              email: true,
            },
          },
          members: {
            where: { isActive: true },
            select: {
              id: true,
              userId: true,
              membershipRole: true,
              user: {
                select: {
                  id: true,
                  memberCode: true,
                  fullName: true,
                  email: true,
                  profileImageUrl: true,
                },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
      },
    },
  },
  members: {
    select: {
      id: true,
      projectRole: true,
      user: {
        select: {
          id: true,
          memberCode: true,
          fullName: true,
          email: true,
          profileImageUrl: true,
        },
      },
    },
  },
  _count: { select: { members: true, papers: true, assignments: true } },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthenticatedUser, query: ListProjectsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const organizationWide = actor.roles.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
    const scope: Prisma.ProjectWhereInput = organizationWide
      ? {}
      : {
          OR: [
            { ownerId: actor.id },
            { members: { some: { userId: actor.id } } },
            {
              teams: {
                some: {
                  team: {
                    members: { some: { userId: actor.id, isActive: true } },
                  },
                },
              },
            },
          ],
        };
    const where: Prisma.ProjectWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...scope,
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: projectSelection,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(actor: AuthenticatedUser, id: string) {
    const organizationWide = actor.roles.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
    const scope: Prisma.ProjectWhereInput = organizationWide
      ? {}
      : {
          OR: [
            { ownerId: actor.id },
            { members: { some: { userId: actor.id } } },
            {
              teams: {
                some: {
                  team: {
                    members: { some: { userId: actor.id, isActive: true } },
                  },
                },
              },
            },
          ],
        };
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null, ...scope },
      select: {
        ...projectSelection,
        members: {
          select: {
            user: {
              select: {
                id: true,
                memberCode: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'Project was not found.',
      });
    }
    return project;
  }

  async create(actor: AuthenticatedUser, dto: CreateProjectDto) {
    if (!actor.permissions.includes('PROJECT_MANAGE')) {
      throw new ForbiddenException({
        code: 'PROJECT_CREATE_NOT_ALLOWED',
        message: 'You are not allowed to create projects.',
      });
    }
    if (
      dto.startDate &&
      dto.targetDate &&
      new Date(dto.targetDate) < new Date(dto.startDate)
    ) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_DATES',
        message: 'The target date must be on or after the project start date.',
      });
    }

    const teamIds = [...new Set(dto.teamIds ?? [])];
    const memberIds = [...new Set(dto.memberIds ?? [])];
    const researchAreaIds = [...new Set(dto.researchAreaIds ?? [])];

    if (dto.ownerId || teamIds.length || memberIds.length) {
      const userIds = [...new Set([...(dto.ownerId ? [dto.ownerId] : []), ...memberIds])];
      if (userIds.length) {
        const users = await this.prisma.user.findMany({
          where: {
            id: { in: userIds },
            organizationId: actor.organizationId,
            status: UserStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (users.length !== userIds.length) {
          throw new BadRequestException({
            code: 'INVALID_PROJECT_MEMBER',
            message: 'Project owner and members must be active users in this organization.',
          });
        }
      }
    }

    if (teamIds.length) {
      const teams = await this.prisma.team.findMany({
        where: {
          id: { in: teamIds },
          organizationId: actor.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (teams.length !== teamIds.length) {
        throw new BadRequestException({
          code: 'INVALID_PROJECT_TEAM',
          message: 'One or more teams are unavailable in this organization.',
        });
      }
    }

    if (researchAreaIds.length) {
      const areas = await this.prisma.researchArea.findMany({
        where: {
          id: { in: researchAreaIds },
          organizationId: actor.organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (areas.length !== researchAreaIds.length) {
        throw new BadRequestException({
          code: 'INVALID_RESEARCH_AREA',
          message: 'One or more research areas are unavailable in this organization.',
        });
      }
    }

    try {
      return await this.prisma.project.create({
        data: {
          organizationId: actor.organizationId,
          projectCode: dto.projectCode.trim(),
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          ownerId: dto.ownerId,
          defaultTeamId: teamIds[0],
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
          createdBy: actor.id,
          teams: { create: teamIds.map((teamId) => ({ teamId })) },
          members: {
            create: [...new Set([...(dto.ownerId ? [dto.ownerId] : []), ...memberIds])].map(
              (userId) => ({ userId, joinedAt: new Date() }),
            ),
          },
          researchAreas: {
            create: researchAreaIds.map((researchAreaId) => ({ researchAreaId })),
          },
        },
        select: projectSelection,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'PROJECT_CODE_ALREADY_EXISTS',
          message: 'A project with this code already exists in the organization.',
        });
      }
      throw error;
    }
  }

  async addTeams(actor: AuthenticatedUser, projectId: string, teamIds: string[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const uniqueIds = [...new Set(teamIds)];
    if (uniqueIds.length === 0) return;

    await this.prisma.projectTeam.createMany({
      data: uniqueIds.map(teamId => ({ projectId, teamId })),
      skipDuplicates: true,
    });

    // Also connect all active team members to ProjectMember
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId: { in: uniqueIds }, isActive: true },
      select: { userId: true },
    });
    if (teamMembers.length > 0) {
      await this.prisma.projectMember.createMany({
        data: teamMembers.map(({ userId }) => ({
          projectId,
          userId,
          joinedAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }
  }

  async addMembers(actor: AuthenticatedUser, projectId: string, memberIds: string[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const uniqueIds = [...new Set(memberIds)];
    if (uniqueIds.length === 0) return;

    await this.prisma.projectMember.createMany({
      data: uniqueIds.map(userId => ({ projectId, userId, joinedAt: new Date() })),
      skipDuplicates: true,
    });
  }

  async delete(actor: AuthenticatedUser, id: string, adminPassword?: string) {
    if (!actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admins can delete projects.',
      });
    }

    const project = await this.prisma.project.findUnique({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async removeMembers(actor: AuthenticatedUser, id: string, memberIds: string[], _adminPassword?: string) {
    if (!actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admins can remove members.',
      });
    }

    const project = await this.prisma.project.findUnique({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (memberIds.length > 0) {
      await this.prisma.projectMember.deleteMany({
        where: { projectId: id, userId: { in: memberIds } },
      });
    }
  }

  async removeTeams(actor: AuthenticatedUser, projectId: string, teamIds: string[]) {
    if (!actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admins can remove teams.',
      });
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (teamIds.length > 0) {
      await this.prisma.projectTeam.deleteMany({
        where: { projectId, teamId: { in: teamIds } },
      });
    }
  }
}
