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
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { ListTeamsDto } from './dto/list-teams.dto.js';

const teamSelection = {
  id: true,
  teamCode: true,
  name: true,
  description: true,
  imageUrl: true,
  startDate: true,
  targetDate: true,
  status: true,
  createdAt: true,
  teamLeader: {
    select: { id: true, memberCode: true, fullName: true, email: true },
  },
  members: {
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      membershipRole: true,
      isActive: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          memberCode: true,
          fullName: true,
          email: true,
          phone: true,
          profileImageUrl: true,
        },
      },
    },
  },
  _count: { select: { members: true, projects: true } },
} satisfies Prisma.TeamSelect;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthenticatedUser, query: ListTeamsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const organizationWide = actor.roles.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
    const where: Prisma.TeamWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(!organizationWide
        ? { members: { some: { userId: actor.id, isActive: true } } }
        : {}),
    };

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        select: teamSelection,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      data: teams,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(actor: AuthenticatedUser, id: string) {
    const organizationWide = actor.roles.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
    const team = await this.prisma.team.findFirst({
      where: {
        id,
        organizationId: actor.organizationId,
        deletedAt: null,
        ...(!organizationWide
          ? { members: { some: { userId: actor.id, isActive: true } } }
          : {}),
      },
      select: {
        ...teamSelection,
        projects: {
          select: {
            project: {
              select: {
                id: true,
                projectCode: true,
                title: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'Team was not found.',
      });
    }
    return team;
  }

  async create(actor: AuthenticatedUser, dto: CreateTeamDto) {
    if (!actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admins can create teams.',
      });
    }

    const memberIds = [...new Set(dto.memberIds ?? [])];
    const researchAreaIds = [...new Set(dto.researchAreaIds ?? [])];
    if (
      dto.startDate &&
      dto.targetDate &&
      new Date(dto.targetDate) < new Date(dto.startDate)
    ) {
      throw new BadRequestException({
        code: 'INVALID_TEAM_DATES',
        message: 'The target date must be on or after the start date.',
      });
    }
    if (
      dto.teamLeaderId &&
      !actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r)) &&
      !actor.permissions.includes('TEAM_LEADER_ASSIGN')
    ) {
      throw new ForbiddenException({
        code: 'TEAM_LEADER_ASSIGNMENT_NOT_ALLOWED',
        message: 'You are not allowed to assign a team leader.',
      });
    }

    const allMemberIds = new Set(memberIds);
    if (dto.teamLeaderId) allMemberIds.add(dto.teamLeaderId);

    if (allMemberIds.size > 0) {
      const validUsers = await this.prisma.user.findMany({
        where: {
          id: { in: [...allMemberIds] },
          organizationId: actor.organizationId,
          status: UserStatus.ACTIVE,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (validUsers.length !== allMemberIds.size) {
        throw new BadRequestException({
          code: 'INVALID_TEAM_MEMBER',
          message: 'All team members and the team leader must be active users in this organization.',
        });
      }
    }

    if (researchAreaIds.length > 0) {
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

    const memberships = new Map<string, string>();
    for (const memberId of memberIds) memberships.set(memberId, 'MEMBER');
    if (dto.teamLeaderId) memberships.set(dto.teamLeaderId, 'TEAM_LEADER');

    try {
      return await this.prisma.team.create({
        data: {
          organizationId: actor.organizationId,
          teamCode: dto.teamCode.trim(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          imageUrl: dto.imageUrl,
          teamLeaderId: dto.teamLeaderId,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
          members: {
            create: [...memberships].map(([userId, membershipRole]) => ({
              userId,
              membershipRole,
              joinedAt: new Date(),
              assignedBy: actor.id,
            })),
          },
          researchAreas: {
            create: researchAreaIds.map((researchAreaId) => ({ researchAreaId })),
          },
        },
        select: teamSelection,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'TEAM_CODE_ALREADY_EXISTS',
          message: 'A team with this code already exists in the organization.',
        });
      }
      throw error;
    }
  }

  async addMembers(actor: AuthenticatedUser, teamId: string, memberIds: string[]) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId, organizationId: actor.organizationId },
    });
    if (!team) throw new NotFoundException('Team not found');

    const uniqueIds = [...new Set(memberIds)];
    if (uniqueIds.length === 0) return;

    await this.prisma.teamMember.createMany({
      data: uniqueIds.map(userId => ({
        teamId,
        userId,
        membershipRole: 'MEMBER',
        assignedBy: actor.id,
      })),
      skipDuplicates: true,
    });
  }

  async delete(actor: AuthenticatedUser, id: string, adminPassword?: string) {
    if (!actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admins can delete teams.',
      });
    }

    const team = await this.prisma.team.findUnique({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.team.update({
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

    const team = await this.prisma.team.findUnique({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!team) throw new NotFoundException('Team not found');

    if (memberIds.length > 0) {
      await this.prisma.teamMember.deleteMany({
        where: { teamId: id, userId: { in: memberIds } },
      });
    }
  }

  async assignLeader(actor: AuthenticatedUser, teamId: string, leaderUserId: string | null) {
    if (!actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admins can assign a team leader.',
      });
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!team) throw new NotFoundException('Team not found');

    const normalizedLeaderId =
      leaderUserId && leaderUserId.trim() !== '' && leaderUserId !== 'none'
        ? leaderUserId.trim()
        : null;

    if (normalizedLeaderId) {
      const user = await this.prisma.user.findFirst({
        where: { id: normalizedLeaderId, organizationId: actor.organizationId, deletedAt: null },
      });
      if (!user) throw new NotFoundException('User not found in organization');

      // Ensure user is active member in TeamMember
      const existingMember = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: normalizedLeaderId } },
      });

      if (!existingMember) {
        await this.prisma.teamMember.create({
          data: {
            teamId,
            userId: normalizedLeaderId,
            membershipRole: 'TEAM_LEADER',
            joinedAt: new Date(),
            assignedBy: actor.id,
            isActive: true,
          },
        });
      } else {
        await this.prisma.teamMember.update({
          where: { teamId_userId: { teamId, userId: normalizedLeaderId } },
          data: { membershipRole: 'TEAM_LEADER', isActive: true },
        });
      }

      // If previous leader was someone else, demote their membershipRole to MEMBER
      if (team.teamLeaderId && team.teamLeaderId !== normalizedLeaderId) {
        await this.prisma.teamMember.updateMany({
          where: { teamId, userId: team.teamLeaderId, membershipRole: 'TEAM_LEADER' },
          data: { membershipRole: 'MEMBER' },
        });
      }

      await this.prisma.team.update({
        where: { id: teamId },
        data: { teamLeaderId: normalizedLeaderId },
      });
    } else {
      // Remove leader
      if (team.teamLeaderId) {
        await this.prisma.teamMember.updateMany({
          where: { teamId, userId: team.teamLeaderId, membershipRole: 'TEAM_LEADER' },
          data: { membershipRole: 'MEMBER' },
        });
      }
      await this.prisma.team.update({
        where: { id: teamId },
        data: { teamLeaderId: null },
      });
    }

    return this.getById(actor, teamId);
  }
}
