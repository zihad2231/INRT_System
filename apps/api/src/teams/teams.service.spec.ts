import { TeamStatus, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { TeamsService } from './teams.service.js';

const admin: AuthenticatedUser = {
  id: 'admin-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'admin@example.com',
  fullName: 'Admin User',
  profileImageUrl: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['ADMIN'],
  permissions: ['TEAM_CREATE', 'TEAM_LEADER_ASSIGN'],
};

const makePrisma = () => ({
  team: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: { findMany: vi.fn() },
  researchArea: { findMany: vi.fn() },
});

describe('TeamsService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let teamsService: TeamsService;

  beforeEach(() => {
    prisma = makePrisma();
    teamsService = new TeamsService(prisma as never);
  });

  it('limits ordinary members to their active teams in their organization', async () => {
    prisma.team.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(0);
    const member = { ...admin, roles: ['MEMBER'] };

    await teamsService.list(member, { page: 1, limit: 20 });

    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          deletedAt: null,
          members: { some: { userId: 'admin-id', isActive: true } },
        }),
      }),
    );
  });

  it('validates organization-owned active team members before creating the team', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'member-id' }]);
    prisma.researchArea.findMany.mockResolvedValue([]);
    prisma.team.create.mockResolvedValue({ id: 'team-id', teamCode: 'AI-01' });

    await teamsService.create(admin, {
      teamCode: ' AI-01 ',
      name: 'AI Research',
      teamLeaderId: 'member-id',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['member-id'] },
        organizationId: 'org-a',
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          teamCode: 'AI-01',
          members: {
            create: [
              expect.objectContaining({
                userId: 'member-id',
                membershipRole: 'TEAM_LEADER',
                assignedBy: 'admin-id',
              }),
            ],
          },
        }),
      }),
    );
  });

  it('rejects a team leader who is not an active user in this organization', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(
      teamsService.create(admin, {
        teamCode: 'AI-02',
        name: 'Another Team',
        teamLeaderId: 'foreign-user',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_TEAM_MEMBER' }),
    });
    expect(prisma.team.create).not.toHaveBeenCalled();
  });

  it('uses team status filters and paginates', async () => {
    prisma.team.findMany.mockResolvedValue([]);
    prisma.team.count.mockResolvedValue(0);

    await teamsService.list(admin, { page: 3, limit: 10, status: TeamStatus.ACTIVE });

    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a', deletedAt: null, status: TeamStatus.ACTIVE },
        skip: 20,
        take: 10,
      }),
    );
  });
});
