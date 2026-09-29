import {
  ServiceUnavailableException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { compare } from 'bcryptjs';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export const SESSION_COOKIE_NAME = 'intellinova_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sessionUserInclude = {
  organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
  userRoles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: { select: { code: true } } } },
        },
      },
    },
  },
  directPermissions: {
    include: { permission: { select: { code: true } } },
  },
  userSkills: {
    include: { skill: { select: { id: true, name: true, category: true } } },
  },
  userResearchAreas: {
    include: { researchArea: { select: { id: true, name: true, slug: true } } },
  },
} as const;

type SessionUserRecord = Prisma.UserGetPayload<{
  include: typeof sessionUserInclude;
}>;

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  memberCode: string;
  email: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  profileImageUrl: string | null;
  bio: string | null;
  phone: string | null;
  organization: { id: string; name: string; slug: string; logoUrl: string | null };
  roles: string[];
  permissions: string[];
  skills: { id: string; name: string; category: string | null; proficiency: string | null; yearsExperience: number | null }[];
  researchAreas: { id: string; name: string; proficiency: string | null }[];
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(identifier: string, password: string) {
    const normalizedIdentifier = identifier.trim();
    let candidates: Array<Prisma.UserGetPayload<{ include: typeof sessionUserInclude }>>;
    try {
      candidates = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: normalizedIdentifier.toLowerCase() },
            { memberCode: normalizedIdentifier },
          ],
        },
        include: { ...sessionUserInclude },
        take: 2,
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_NOT_READY',
        message: 'Database is not configured or unavailable. Configure PostgreSQL before signing in.',
      });
    }
    const user = candidates.length === 1 ? candidates[0] : null;

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      !(await compare(password, user.passwordHash))
    ) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      });
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      token,
      expiresAt,
      user: this.toAuthenticatedUser(user),
    };
  }

  async getSessionUser(token: string | undefined): Promise<AuthenticatedUser> {
    if (!token) {
      throw this.unauthorized();
    }

    const session = await this.prisma.session.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE, deletedAt: null },
      },
      include: {
        user: { include: { ...sessionUserInclude } },
      },
    });

    if (!session) {
      throw this.unauthorized();
    }

    return this.toAuthenticatedUser(session.user);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;

    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private unauthorized(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'A valid login session is required.',
    });
  }

  private toAuthenticatedUser(user: SessionUserRecord): AuthenticatedUser {
    const roles = user.userRoles
      .filter((userRole) => userRole.role.organizationId === user.organizationId)
      .map((userRole) => userRole.role);
    const permissionMap = new Map<string, boolean>();

    for (const role of roles) {
      for (const { permission } of role.permissions) {
        permissionMap.set(permission.code, true);
      }
    }
    for (const { permission, granted } of user.directPermissions) {
      permissionMap.set(permission.code, granted);
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      memberCode: user.memberCode,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      profileImageUrl: user.profileImageUrl,
      bio: user.bio,
      phone: user.phone,
      organization: user.organization,
      roles: roles.map((role) => role.code),
      permissions: [...permissionMap]
        .filter(([, granted]) => granted)
        .map(([code]) => code)
        .sort(),
      skills: user.userSkills.map((us) => ({
        id: us.skill.id,
        name: us.skill.name,
        category: us.skill.category,
        proficiency: us.proficiency,
        yearsExperience: us.yearsExperience ? Number(us.yearsExperience) : null,
      })),
      researchAreas: user.userResearchAreas.map((ura) => ({
        id: ura.researchArea.id,
        name: ura.researchArea.name,
        proficiency: ura.proficiency,
      })),
    };
  }
}
