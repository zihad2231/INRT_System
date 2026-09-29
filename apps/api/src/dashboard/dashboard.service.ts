import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMemberDashboard(actor: AuthenticatedUser) {
    const now = new Date();
    const organizationWide = actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
    const projectScope: Prisma.ProjectWhereInput = organizationWide
      ? {}
      : {
          OR: [
            { ownerId: actor.id },
            { members: { some: { userId: actor.id } } },
            { teams: { some: { team: { members: { some: { userId: actor.id, isActive: true } } } } } },
          ],
        };
    const taskScope: Prisma.TaskWhereInput = organizationWide
      ? {}
      : {
          OR: [
            { createdBy: actor.id },
            { assignees: { some: { userId: actor.id } } },
            { team: { members: { some: { userId: actor.id, isActive: true } } } },
            { project: { OR: [{ ownerId: actor.id }, { members: { some: { userId: actor.id } } }] } },
          ],
        };

    const noticeWhere: Prisma.NoticeWhereInput = {
      organizationId: actor.organizationId,
      status: 'PUBLISHED',
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [
        { scope: 'CENTRAL' },
        { scope: 'INDIVIDUAL', users: { some: { userId: actor.id } } },
        { scope: 'TEAM', teams: { some: { team: { members: { some: { userId: actor.id, isActive: true } } } } } },
      ] }],
    };

    const [projects, tasks, notices, teamCount, paperCount] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId: actor.organizationId, deletedAt: null, ...projectScope },
        select: {
          id: true, projectCode: true, title: true, status: true, progressPercent: true,
          targetDate: true, _count: { select: { members: true, papers: true, assignments: true } },
          owner: { select: { id: true, memberCode: true, fullName: true } },
          teams: { select: { team: { select: { id: true, teamCode: true, name: true } } } },
        },
        orderBy: { updatedAt: 'desc' }, take: 6,
      }),
      this.prisma.task.findMany({
        where: { organizationId: actor.organizationId, deletedAt: null, ...taskScope },
        select: { id: true, taskCode: true, title: true, status: true, priority: true, dueDate: true, progressPercent: true, project: { select: { id: true, projectCode: true, title: true } }, team: { select: { id: true, teamCode: true, name: true } } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }], take: 6,
      }),
      this.prisma.notice.findMany({
        where: noticeWhere,
        select: { id: true, title: true, content: true, priority: true, scope: true, publishAt: true, expiresAt: true, requiresAcknowledgement: true, author: { select: { id: true, memberCode: true, fullName: true } }, acknowledgements: { where: { userId: actor.id }, select: { acknowledgedAt: true }, take: 1 } },
        orderBy: [{ priority: 'asc' }, { publishAt: 'desc' }], take: 4,
      }),
      this.prisma.team.count({ where: { organizationId: actor.organizationId, deletedAt: null, ...(!organizationWide ? { members: { some: { userId: actor.id, isActive: true } } } : {}) } }),
      this.prisma.projectPaper.count({ where: { project: { organizationId: actor.organizationId, deletedAt: null, ...projectScope } } }),
    ]);

    return {
      metrics: {
        projects: await this.prisma.project.count({ where: { organizationId: actor.organizationId, deletedAt: null, ...projectScope } }),
        teams: teamCount,
        papers: paperCount,
        openTasks: tasks.filter((task) => task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.CANCELLED).length,
        notices: notices.length,
      },
      projects,
      tasks,
      notices: notices.map(({ acknowledgements, ...notice }) => ({ ...notice, acknowledgedAt: acknowledgements[0]?.acknowledgedAt ?? null })),
    };
  }
}