import { UserStatus } from '@prisma/client';
import { compare } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { UsersService } from './users.service.js';

const actor: AuthenticatedUser = {
  id: 'admin-id',
  organizationId: 'org-a',
  memberCode: 'INT-000001',
  email: 'admin@example.com',
  fullName: 'Admin User',
  profileImageUrl: null,
  organization: { id: 'org-a', name: 'Organization A', slug: 'org-a', logoUrl: null },
  roles: ['ADMIN'],
  permissions: ['USER_VIEW', 'USER_CREATE'],
};

const makePrisma = () => ({
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  role: { findMany: vi.fn() },
});

describe('UsersService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let usersService: UsersService;

  beforeEach(() => {
    prisma = makePrisma();
    usersService = new UsersService(prisma as never);
  });

  it('lists only users in the caller organization with bounded pagination', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    const result = await usersService.list(actor, { page: 2, limit: 25 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a', deletedAt: null },
        skip: 25,
        take: 25,
      }),
    );
    expect(result.meta).toEqual({ page: 2, limit: 25, total: 0, totalPages: 0 });
  });

  it('creates an invited user with a bcrypt password hash and no cross-organization role access', async () => {
    prisma.user.create.mockImplementation(async ({ data, select }) => ({
      id: 'new-user-id',
      memberCode: data.memberCode,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: data.fullName,
      status: data.status,
      createdAt: new Date(),
      userRoles: select.userRoles ? [] : undefined,
    }));

    const created = await usersService.create(actor, {
      memberCode: 'INT-000002',
      email: 'NEW@EXAMPLE.COM',
      password: 'a-long-temporary-password',
      firstName: 'New',
      lastName: 'Member',
    });

    const createData = prisma.user.create.mock.calls[0]?.[0].data;
    expect(createData.organizationId).toBe('org-a');
    expect(createData.email).toBe('new@example.com');
    expect(createData.status).toBe(UserStatus.INVITED);
    expect(createData.passwordHash).not.toBe('a-long-temporary-password');
    expect(await compare('a-long-temporary-password', createData.passwordHash)).toBe(true);
    expect(created).not.toHaveProperty('passwordHash');
  });

  it('requires ROLE_ASSIGN before adding roles to a newly created user', async () => {
    await expect(
      usersService.create(actor, {
        memberCode: 'INT-000003',
        email: 'member@example.com',
        password: 'a-long-temporary-password',
        firstName: 'Member',
        roleCodes: ['MEMBER'],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ROLE_ASSIGNMENT_NOT_ALLOWED' }),
    });
    expect(prisma.role.findMany).not.toHaveBeenCalled();
  });
});
