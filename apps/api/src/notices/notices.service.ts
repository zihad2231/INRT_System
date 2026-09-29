import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NoticePriority,
  NoticeScope,
  NoticeStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateNoticeDto } from './dto/create-notice.dto.js';
import type { ListNoticesDto } from './dto/list-notices.dto.js';

const noticeSelection = {
  id: true,
  title: true,
  content: true,
  priority: true,
  scope: true,
  publishAt: true,
  expiresAt: true,
  requiresAcknowledgement: true,
  status: true,
  createdAt: true,
  author: { select: { id: true, memberCode: true, fullName: true } },
  teams: { select: { team: { select: { id: true, teamCode: true, name: true } } } },
  users: { select: { user: { select: { id: true, memberCode: true, fullName: true } } } },
} satisfies Prisma.NoticeSelect;

@Injectable()
export class NoticesService {
  constructor(private readonly prisma: PrismaService) {}

  async listVisible(actor: AuthenticatedUser, query: ListNoticesDto) {
    const now = new Date();
    const where: Prisma.NoticeWhereInput = {
      organizationId: actor.organizationId,
      status: NoticeStatus.PUBLISHED,
      publishAt: { lte: now },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
      AND: [
        {
          OR: [
            { scope: NoticeScope.CENTRAL },
            {
              scope: NoticeScope.TEAM,
              teams: {
                some: {
                  team: {
                    members: { some: { userId: actor.id, isActive: true } },
                  },
                },
              },
            },
            {
              scope: NoticeScope.INDIVIDUAL,
              users: { some: { userId: actor.id } },
            },
          ],
        },
      ],
    };
    const [notices, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        select: {
          ...noticeSelection,
          acknowledgements: {
            where: { userId: actor.id },
            select: { acknowledgedAt: true },
            take: 1,
          },
        },
        orderBy: [{ priority: 'asc' }, { publishAt: 'desc' }],
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.notice.count({ where }),
    ]);
    return {
      data: notices.map((notice) => {
        const { acknowledgements, ...safeNotice } = notice;
        return {
          ...safeNotice,
          acknowledgedAt: acknowledgements[0]?.acknowledgedAt ?? null,
        };
      }),
      meta: {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total,
        totalPages: Math.ceil(total / (query.limit ?? 20)),
      },
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateNoticeDto) {
    this.requireCreatePermission(actor, dto.scope);
    const teamIds = [...new Set(dto.teamIds ?? [])];
    const userIds = [...new Set(dto.userIds ?? [])];
    if (dto.scope === NoticeScope.CENTRAL && (teamIds.length || userIds.length)) {
      throw new BadRequestException({
        code: 'NOTICE_TARGETS_NOT_ALLOWED',
        message: 'Central notices cannot include explicit team or user targets.',
      });
    }
    if (dto.scope === NoticeScope.TEAM && (!teamIds.length || userIds.length)) {
      throw new BadRequestException({
        code: 'NOTICE_TEAM_TARGET_REQUIRED',
        message: 'Team notices require one or more teams and cannot target individual users.',
      });
    }
    if (dto.scope === NoticeScope.INDIVIDUAL && (!userIds.length || teamIds.length)) {
      throw new BadRequestException({
        code: 'NOTICE_USER_TARGET_REQUIRED',
        message: 'Individual notices require one or more users and cannot target teams.',
      });
    }
    const publishAt = dto.publishAt ? new Date(dto.publishAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt <= publishAt) {
      throw new BadRequestException({
        code: 'INVALID_NOTICE_DATES',
        message: 'Notice expiry must be later than its publish time.',
      });
    }

    if (teamIds.length) {
      const teams = await this.prisma.team.findMany({
        where: { id: { in: teamIds }, organizationId: actor.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (teams.length !== teamIds.length) {
        throw new BadRequestException({
          code: 'INVALID_NOTICE_TEAM',
          message: 'All notice teams must belong to this organization.',
        });
      }
    }
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
          code: 'INVALID_NOTICE_USER',
          message: 'All notice recipients must be active users in this organization.',
        });
      }
    }

    return this.prisma.notice.create({
      data: {
        organizationId: actor.organizationId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        priority: dto.priority ?? NoticePriority.NORMAL,
        scope: dto.scope,
        createdBy: actor.id,
        publishAt,
        expiresAt,
        requiresAcknowledgement: dto.requiresAcknowledgement ?? false,
        // Future publication is time-gated by publishAt in listVisible; no
        // scheduled job is needed to reveal a notice at the right time.
        status: NoticeStatus.PUBLISHED,
        teams: { create: teamIds.map((teamId) => ({ teamId })) },
        users: { create: userIds.map((userId) => ({ userId })) },
      },
      select: noticeSelection,
    });
  }

  async acknowledge(actor: AuthenticatedUser, noticeId: string) {
    const now = new Date();
    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        organizationId: actor.organizationId,
        status: NoticeStatus.PUBLISHED,
        publishAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [
          {
            OR: [
              { scope: NoticeScope.CENTRAL },
              {
                scope: NoticeScope.TEAM,
                teams: { some: { team: { members: { some: { userId: actor.id, isActive: true } } } } },
              },
              { scope: NoticeScope.INDIVIDUAL, users: { some: { userId: actor.id } } },
            ],
          },
        ],
      },
      select: { id: true, requiresAcknowledgement: true },
    });
    if (!notice) throw this.noticeNotFound();
    if (!notice.requiresAcknowledgement) {
      throw new BadRequestException({
        code: 'NOTICE_ACKNOWLEDGEMENT_NOT_REQUIRED',
        message: 'This notice does not require acknowledgement.',
      });
    }
    try {
      return await this.prisma.noticeAcknowledgement.create({
        data: { noticeId: notice.id, userId: actor.id },
        select: { id: true, acknowledgedAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'NOTICE_ALREADY_ACKNOWLEDGED',
          message: 'You have already acknowledged this notice.',
        });
      }
      throw error;
    }
  }

  async acknowledgementSummary(actor: AuthenticatedUser, noticeId: string) {
    if (!actor.permissions.includes('NOTICE_MANAGE') && !actor.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        code: 'NOTICE_MANAGE_NOT_ALLOWED',
        message: 'You are not allowed to view acknowledgement summaries.',
      });
    }
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, organizationId: actor.organizationId },
      select: {
        id: true,
        scope: true,
        requiresAcknowledgement: true,
        users: { select: { userId: true } },
        teams: {
          select: { team: { select: { members: { where: { isActive: true }, select: { userId: true } } } } },
        },
      },
    });
    if (!notice) throw this.noticeNotFound();
    if (!notice.requiresAcknowledgement) {
      throw new BadRequestException({
        code: 'NOTICE_ACKNOWLEDGEMENT_NOT_REQUIRED',
        message: 'This notice does not require acknowledgement.',
      });
    }
    const recipientIds = new Set<string>();
    if (notice.scope === NoticeScope.CENTRAL) {
      const users = await this.prisma.user.findMany({
        where: { organizationId: actor.organizationId, status: UserStatus.ACTIVE, deletedAt: null },
        select: { id: true },
      });
      users.forEach(({ id }) => recipientIds.add(id));
    } else if (notice.scope === NoticeScope.INDIVIDUAL) {
      notice.users.forEach(({ userId }) => recipientIds.add(userId));
    } else {
      notice.teams.forEach(({ team }) => team.members.forEach(({ userId }) => recipientIds.add(userId)));
    }
    const acknowledged = await this.prisma.noticeAcknowledgement.count({
      where: { noticeId, userId: { in: [...recipientIds] } },
    });
    const total = recipientIds.size;
    return {
      total,
      acknowledged,
      notAcknowledged: Math.max(total - acknowledged, 0),
      percentage: total ? Math.round((acknowledged / total) * 100) : 0,
    };
  }

  private requireCreatePermission(actor: AuthenticatedUser, scope: NoticeScope) {
    const permission = {
      [NoticeScope.CENTRAL]: 'NOTICE_CREATE_CENTRAL',
      [NoticeScope.TEAM]: 'NOTICE_CREATE_TEAM',
      [NoticeScope.INDIVIDUAL]: 'NOTICE_CREATE_INDIVIDUAL',
    }[scope];
    if (!actor.permissions.includes(permission) && !actor.permissions.includes('NOTICE_MANAGE')) {
      throw new ForbiddenException({
        code: 'NOTICE_CREATE_NOT_ALLOWED',
        message: `You are not allowed to create ${scope.toLowerCase()} notices.`,
      });
    }
  }

  private noticeNotFound() {
    return new NotFoundException({
      code: 'NOTICE_NOT_FOUND',
      message: 'Notice was not found or is not visible to you.',
    });
  }
}
