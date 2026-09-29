import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';

const makePrisma = () => ({
  user: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  session: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
});

describe('AuthService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let authService: AuthService;

  beforeEach(() => {
    prisma = makePrisma();
    authService = new AuthService(prisma as never);
  });

  it('creates a hashed opaque session and returns effective permissions on login', async () => {
    const passwordHash = await hash('correct horse battery staple', 4);
    prisma.user.findMany.mockResolvedValue([{
      id: 'user-id',
      organizationId: 'org-id',
      memberCode: 'INT-000001',
      email: 'person@example.com',
      passwordHash,
      fullName: 'Researcher One',
      profileImageUrl: null,
      status: UserStatus.ACTIVE,
      organization: { id: 'org-id', name: 'IntelliNova', slug: 'intellinova' },
      userRoles: [
        {
          role: {
            organizationId: 'org-id',
            code: 'MEMBER',
            permissions: [
              { permission: { code: 'PAPER_READ' } },
              { permission: { code: 'PROJECT_VIEW' } },
            ],
          },
        },
        {
          role: {
            organizationId: 'another-org',
            code: 'ADMIN',
            permissions: [{ permission: { code: 'USER_MANAGE' } }],
          },
        },
      ],
      directPermissions: [
        { granted: false, permission: { code: 'PROJECT_VIEW' } },
        { granted: true, permission: { code: 'REPORT_EXPORT' } },
      ],
    }]);

    const result = await authService.login(' PERSON@EXAMPLE.COM ', 'correct horse battery staple');

    expect(result.token).toHaveLength(43);
    expect(result.user.roles).toEqual(['MEMBER']);
    expect(result.user.permissions).toEqual(['PAPER_READ', 'REPORT_EXPORT']);
    expect(JSON.stringify(result.user)).not.toContain(passwordHash);
    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-id',
        tokenHash: expect.not.stringContaining(result.token),
        expiresAt: expect.any(Date),
      }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('does not reveal whether an email exists or an account is inactive', async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await expect(authService.login('missing@example.com', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    prisma.user.findMany.mockResolvedValue([{
      status: UserStatus.SUSPENDED,
      passwordHash: 'not-used',
    }]);
    await expect(authService.login('person@example.com', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a member code as a login identifier', async () => {
    const passwordHash = await hash('a valid long password', 4);
    prisma.user.findMany.mockResolvedValue([{
      id: 'user-id',
      organizationId: 'org-id',
      memberCode: 'inrt2100',
      email: 'inrt2100@local.intellinova.invalid',
      passwordHash,
      fullName: 'IntelliNova Admin',
      profileImageUrl: null,
      status: UserStatus.ACTIVE,
      organization: { id: 'org-id', name: 'IntelliNova', slug: 'intellinova' },
      userRoles: [],
      directPermissions: [],
    }]);

    await expect(authService.login('inrt2100', 'a valid long password')).resolves.toMatchObject({
      user: { memberCode: 'inrt2100' },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ email: 'inrt2100' }, { memberCode: 'inrt2100' }] },
        take: 2,
      }),
    );
  });

  it('fails closed if a member code matches multiple organizations', async () => {
    prisma.user.findMany.mockResolvedValue([
      { status: UserStatus.ACTIVE },
      { status: UserStatus.ACTIVE },
    ]);

    await expect(authService.login('duplicate-code', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('rejects missing and invalid sessions', async () => {
    await expect(authService.getSessionUser(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    prisma.session.findFirst.mockResolvedValue(null);
    await expect(authService.getSessionUser('invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes a session by token hash without storing the raw token', async () => {
    await authService.logout('opaque-token');

    const [call] = prisma.session.updateMany.mock.calls[0] ?? [];
    expect(call.where.tokenHash).not.toBe('opaque-token');
    expect(call.where.revokedAt).toBeNull();
    expect(call.data.revokedAt).toBeInstanceOf(Date);
  });
});
