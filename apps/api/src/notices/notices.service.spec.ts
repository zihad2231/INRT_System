import { NoticePriority, NoticeScope, NoticeStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { NoticesService } from './notices.service.js';

const member: AuthenticatedUser = {
  id: 'member-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'member@example.com',
  firstName: 'Member',
  lastName: 'User',
  fullName: 'Member User',
  profileImageUrl: null,
  bio: null,
  phone: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['MEMBER'],
  permissions: [],
  skills: [],
  researchAreas: [],
};

const makePrisma = () => ({
  notice: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  noticeAcknowledgement: { create: vi.fn(), count: vi.fn() },
  team: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
});

describe('NoticesService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: NoticesService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new NoticesService(prisma as never);
  });

  it('returns only currently published notices targeted to this member', async () => {
    prisma.notice.findMany.mockResolvedValue([
      {
        id: 'notice-id',
        scope: NoticeScope.INDIVIDUAL,
        acknowledgements: [{ acknowledgedAt: new Date('2026-09-01T00:00:00Z') }],
      },
    ]);
    prisma.notice.count.mockResolvedValue(1);

    const result = await service.listVisible(member, { page: 1, limit: 20 });

    expect(prisma.notice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a',
          status: NoticeStatus.PUBLISHED,
          AND: [
            expect.objectContaining({
              OR: expect.arrayContaining([
                { scope: NoticeScope.CENTRAL },
                expect.objectContaining({ scope: NoticeScope.TEAM }),
                expect.objectContaining({ scope: NoticeScope.INDIVIDUAL }),
              ]),
            }),
          ],
        }),
      }),
    );
    expect(result.data[0]?.acknowledgedAt).toEqual(new Date('2026-09-01T00:00:00Z'));
  });

  it('requires scope-specific permissions before creating a central notice', async () => {
    await expect(
      service.create(member, {
        title: 'Announcement',
        content: 'Organization update',
        scope: NoticeScope.CENTRAL,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOTICE_CREATE_NOT_ALLOWED' }),
    });
    expect(prisma.notice.create).not.toHaveBeenCalled();
  });

  it('validates every team target belongs to the caller organization', async () => {
    const noticeManager = {
      ...member,
      permissions: ['NOTICE_CREATE_TEAM'],
    };
    prisma.team.findMany.mockResolvedValue([]);

    await expect(
      service.create(noticeManager, {
        title: 'Team update',
        content: 'Please review.',
        scope: NoticeScope.TEAM,
        teamIds: ['foreign-team'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_NOTICE_TEAM' }),
    });
    expect(prisma.notice.create).not.toHaveBeenCalled();
  });

  it('rejects a central notice with explicit target IDs', async () => {
    const noticeManager = {
      ...member,
      permissions: ['NOTICE_CREATE_CENTRAL'],
    };

    await expect(
      service.create(noticeManager, {
        title: 'Central update',
        content: 'For all.',
        scope: NoticeScope.CENTRAL,
        userIds: ['member-id'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOTICE_TARGETS_NOT_ALLOWED' }),
    });
  });

  it('rejects expiry earlier than publication time', async () => {
    const noticeManager = {
      ...member,
      permissions: ['NOTICE_CREATE_CENTRAL'],
    };

    await expect(
      service.create(noticeManager, {
        title: 'Bad dates',
        content: 'Invalid window.',
        scope: NoticeScope.CENTRAL,
        publishAt: '2026-10-02T00:00:00.000Z',
        expiresAt: '2026-10-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'INVALID_NOTICE_DATES' }),
    });
  });

  it('creates a scheduled notice as published but keeps it hidden until publish time', async () => {
    const noticeManager = {
      ...member,
      permissions: ['NOTICE_CREATE_CENTRAL'],
    };
    prisma.notice.create.mockResolvedValue({ id: 'notice-id', status: NoticeStatus.PUBLISHED });

    await service.create(noticeManager, {
      title: 'Future notice',
      content: 'Visible later.',
      scope: NoticeScope.CENTRAL,
      priority: NoticePriority.URGENT,
      publishAt: '2026-10-01T00:00:00.000Z',
    });

    expect(prisma.notice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: NoticeStatus.PUBLISHED,
          scope: NoticeScope.CENTRAL,
          teams: { create: [] },
          users: { create: [] },
        }),
      }),
    );
  });

  it('acknowledges an eligible notice once per member', async () => {
    prisma.notice.findFirst.mockResolvedValue({ id: 'notice-id', requiresAcknowledgement: true });
    prisma.noticeAcknowledgement.create.mockResolvedValue({ id: 'ack-id' });

    await service.acknowledge(member, 'notice-id');

    expect(prisma.noticeAcknowledgement.create).toHaveBeenCalledWith({
      data: { noticeId: 'notice-id', userId: 'member-id' },
      select: { id: true, acknowledgedAt: true },
    });
  });

  it('rejects acknowledgements where the notice is not marked as requiring one', async () => {
    prisma.notice.findFirst.mockResolvedValue({ id: 'notice-id', requiresAcknowledgement: false });

    await expect(service.acknowledge(member, 'notice-id')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOTICE_ACKNOWLEDGEMENT_NOT_REQUIRED' }),
    });
    expect(prisma.noticeAcknowledgement.create).not.toHaveBeenCalled();
  });

  it('computes acknowledgement percentage using only the individual recipient set', async () => {
    const manager = { ...member, permissions: ['NOTICE_MANAGE'] };
    prisma.notice.findFirst.mockResolvedValue({
      id: 'notice-id',
      scope: NoticeScope.INDIVIDUAL,
      requiresAcknowledgement: true,
      users: [{ userId: 'member-id' }, { userId: 'other-id' }],
      teams: [],
    });
    prisma.noticeAcknowledgement.count.mockResolvedValue(1);

    await expect(service.acknowledgementSummary(manager, 'notice-id')).resolves.toEqual({
      total: 2,
      acknowledged: 1,
      notAcknowledged: 1,
      percentage: 50,
    });
    expect(prisma.noticeAcknowledgement.count).toHaveBeenCalledWith({
      where: { noticeId: 'notice-id', userId: { in: ['member-id', 'other-id'] } },
    });
  });
});
