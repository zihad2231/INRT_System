import { ProjectStatus, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { ProjectsService } from './projects.service.js';

const admin: AuthenticatedUser = {
  id: 'admin-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  fullName: 'Admin User',
  profileImageUrl: null,
  bio: null,
  phone: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['ADMIN'],
  permissions: ['PROJECT_MANAGE'],
  skills: [],
  researchAreas: [],
};

const makePrisma = () => ({
  project: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: { findMany: vi.fn() },
  team: { findMany: vi.fn() },
  researchArea: { findMany: vi.fn() },
});

describe('ProjectsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let projectsService: ProjectsService;

  beforeEach(() => {
    prisma = makePrisma();
    projectsService = new ProjectsService(prisma as never);
  });

  it('limits ordinary members to owned, joined, or team-associated projects', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.count.mockResolvedValue(0);

    await projectsService.list({ ...admin, roles: ['MEMBER'] }, { page: 1, limit: 20 });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          deletedAt: null,
          OR: [
            { ownerId: 'admin-id' },
            { members: { some: { userId: 'admin-id' } } },
            {
              teams: {
                some: {
                  team: {
                    members: { some: { userId: 'admin-id', isActive: true } },
                  },
                },
              },
            },
          ],
        }),
      }),
    );
  });

  it('requires project-management permission to create', async () => {
    await expect(
      projectsService.create(
        { ...admin, permissions: [] },
        { projectCode: 'PRJ-1', title: 'Project One' },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROJECT_CREATE_NOT_ALLOWED' }),
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('validates owner and team membership references against the active organization', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'owner-id' }]);
    prisma.team.findMany.mockResolvedValue([]);

    await expect(
      projectsService.create(admin, {
        projectCode: 'PRJ-2',
        title: 'Project Two',
        ownerId: 'owner-id',
        teamIds: ['foreign-team-id'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_PROJECT_TEAM' }),
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          status: UserStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('creates project and related team/member/area rows through one nested write', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'member-id' }]);
    prisma.team.findMany.mockResolvedValue([{ id: 'team-id' }]);
    prisma.researchArea.findMany.mockResolvedValue([{ id: 'area-id' }]);
    prisma.project.create.mockResolvedValue({ id: 'project-id', projectCode: 'PRJ-3' });

    await projectsService.create(admin, {
      projectCode: ' PRJ-3 ',
      title: ' A project ',
      ownerId: 'member-id',
      teamIds: ['team-id'],
      memberIds: ['member-id'],
      researchAreaIds: ['area-id'],
    });

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          projectCode: 'PRJ-3',
          title: 'A project',
          createdBy: 'admin-id',
          defaultTeamId: 'team-id',
          teams: { create: [{ teamId: 'team-id' }] },
          members: { create: [{ userId: 'member-id', joinedAt: expect.any(Date) }] },
          researchAreas: { create: [{ researchAreaId: 'area-id' }] },
        }),
      }),
    );
  });

  it('rejects an invalid date range before database writes', async () => {
    await expect(
      projectsService.create(admin, {
        projectCode: 'PRJ-4',
        title: 'Invalid dates',
        startDate: '2026-10-12',
        targetDate: '2026-10-11',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_PROJECT_DATES' }),
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('filters projects by status and pagination', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    prisma.project.count.mockResolvedValue(0);

    await projectsService.list(admin, {
      page: 2,
      limit: 10,
      status: ProjectStatus.ACTIVE,
    });

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org-a',
          deletedAt: null,
          status: ProjectStatus.ACTIVE,
        },
        skip: 10,
        take: 10,
      }),
    );
  });
});
