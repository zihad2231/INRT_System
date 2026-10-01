import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { hash, compare } from 'bcryptjs';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersDto } from './dto/list-users.dto.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AuthenticatedUser, query: ListUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = {
      organizationId: actor.organizationId,
      deletedAt: null,
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          memberCode: true,
          email: true,
          firstName: true,
          lastName: true,
          fullName: true,
          profileImageUrl: true,
          phone: true,
          bio: true,
          status: true,
          joiningDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto) {
    const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
    const isAdmin = actor.roles.includes('ADMIN');
    if (!isSuperAdmin && !isAdmin) {
      throw new ForbiddenException({
        code: 'USER_CREATE_NOT_ALLOWED',
        message: 'Only Admin or Super Admin can create users.',
      });
    }

    const roleCodes = [...new Set(dto.roleCodes ?? [])];
    let roles: Array<{ id: string; code: string; isSystemRole: boolean }> = [];

    if (roleCodes.length > 0) {
      if (!isSuperAdmin && !actor.permissions.includes('ROLE_ASSIGN')) {
        throw new ForbiddenException({
          code: 'ROLE_ASSIGNMENT_NOT_ALLOWED',
          message: 'You are not allowed to assign roles.',
        });
      }

      roles = (await this.prisma.role.findMany({
        where: { organizationId: actor.organizationId, code: { in: roleCodes } },
        select: { id: true, code: true, isSystemRole: true },
      })) ?? [];
      if (roles.length !== roleCodes.length) {
        throw new BadRequestException({
          code: 'UNKNOWN_ROLE',
          message: 'One or more role codes are not available in this organization.',
        });
      }
      if (
        roles.some((role) => role.code === 'SUPER_ADMIN' || role.code === 'ADMIN' || role.isSystemRole) &&
        !isSuperAdmin
      ) {
        throw new ForbiddenException({
          code: 'SYSTEM_ROLE_ASSIGNMENT_NOT_ALLOWED',
          message: 'Only a Super Admin can assign an Admin or system role.',
        });
      }
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existingSoftDeleted = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: { not: null } },
    });
    if (existingSoftDeleted) {
      await this.deleteUser(actor, existingSoftDeleted.id);
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.prisma.user.create({
        data: {
          organizationId: actor.organizationId,
          memberCode: dto.memberCode ? dto.memberCode.trim() : `inrt-${Math.floor(Math.random() * 1000000)}`,
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim() || null,
          fullName: [dto.firstName.trim(), dto.lastName?.trim()]
            .filter(Boolean)
            .join(' '),
          profileImageUrl: dto.profileImageUrl ?? null,
          status: dto.status ?? UserStatus.INVITED,
          userRoles: {
            create: roles.map((role) => ({
              role: { connect: { id: role.id } },
              assigner: { connect: { id: actor.id } },
            })),
          },
        },
        select: {
          id: true,
          memberCode: true,
          email: true,
          firstName: true,
          lastName: true,
          fullName: true,
          profileImageUrl: true,
          status: true,
          createdAt: true,
          userRoles: { select: { role: { select: { code: true } } } },
        },
      });

      const { userRoles, ...safeUser } = user;
      return { ...safeUser, roles: userRoles.map(({ role }) => role.code) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'USER_ALREADY_EXISTS',
          message: 'A user with this email or member code already exists.',
        });
      }
      throw error;
    }
  }

  async resetPassword(actor: AuthenticatedUser, userId: string, newPassword: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!target || target.organizationId !== actor.organizationId) {
      throw new BadRequestException('User not found.');
    }

    const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async deleteUser(actor: AuthenticatedUser, userId: string, _adminPassword?: string) {
    if (!actor.roles.includes('SUPER_ADMIN') && !actor.roles.includes('ADMIN')) {
      throw new ForbiddenException({
        code: 'ADMIN_REQUIRED',
        message: 'Only Admin or Super Admin can remove members.',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!target || target.organizationId !== actor.organizationId) {
      throw new BadRequestException('User not found.');
    }
    if (target.id === actor.id) {
      throw new BadRequestException('You cannot remove yourself.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Reassign / nullify relations
      await tx.team.updateMany({ where: { teamLeaderId: userId }, data: { teamLeaderId: null } });
      await tx.teamMember.updateMany({ where: { assignedBy: userId }, data: { assignedBy: null } });
      await tx.userRole.updateMany({ where: { assignedBy: userId }, data: { assignedBy: null } });
      await tx.userPermission.updateMany({ where: { assignedBy: userId }, data: { assignedBy: null } });
      await tx.paperAssignment.updateMany({ where: { assignedBy: userId }, data: { assignedBy: actor.id } });
      await tx.taskAssignee.updateMany({ where: { assignedBy: userId }, data: { assignedBy: actor.id } });
      await tx.assetAssignment.updateMany({ where: { assignedBy: userId }, data: { assignedBy: actor.id } });
      await tx.paperAssignmentConflict.updateMany({ where: { resolvedBy: userId }, data: { resolvedBy: null } });
      await tx.project.updateMany({ where: { ownerId: userId }, data: { ownerId: actor.id } });
      await tx.project.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.paper.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.projectPaper.updateMany({ where: { addedBy: userId }, data: { addedBy: actor.id } });
      await tx.questionSet.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.asset.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.notice.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.task.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.todo.updateMany({ where: { createdBy: userId }, data: { createdBy: actor.id } });
      await tx.todo.updateMany({ where: { userId }, data: { userId: null } });
      await tx.researchSubmission.updateMany({ where: { reviewedBy: userId }, data: { reviewedBy: null } });
      await tx.researchSubmission.updateMany({ where: { submittedBy: userId }, data: { submittedBy: actor.id } });

      // 2. Delete user-specific records
      await tx.paperAssignmentConflict.deleteMany({ where: { requestedBy: userId } });
      await tx.paperAssignment.deleteMany({ where: { userId } });
      await tx.researchResponse.deleteMany({ where: { userId } });
      await tx.taskAssignee.deleteMany({ where: { userId } });
      await tx.projectMember.deleteMany({ where: { userId } });
      await tx.teamMember.deleteMany({ where: { userId } });
      await tx.noticeAcknowledgement.deleteMany({ where: { userId } });
      await tx.noticeUser.deleteMany({ where: { userId } });
      await tx.assetAssignment.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.exportJob.deleteMany({ where: { requestedBy: userId } });
      await tx.auditLog.updateMany({ where: { actorId: userId }, data: { actorId: null } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.userSkill.deleteMany({ where: { userId } });
      await tx.userResearchArea.deleteMany({ where: { userId } });
      await tx.userPermission.deleteMany({ where: { userId } });
      await tx.userRole.deleteMany({ where: { userId } });

      // 3. Delete user completely from database
      await tx.user.delete({ where: { id: userId } });
    });
  }

  async updateProfile(
    actor: AuthenticatedUser,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      bio?: string;
      phone?: string;
      profileImageUrl?: string;
      skills?: string[];
      researchAreas?: string[];
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const updateData: Prisma.UserUpdateInput = {};
      if (data.bio !== undefined) updateData.bio = data.bio;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;

      if (data.email !== undefined && data.email.trim()) {
        const normalized = data.email.trim().toLowerCase();
        const existing = await tx.user.findFirst({
          where: { email: normalized, id: { not: actor.id } },
        });
        if (existing) {
          throw new ConflictException('A user with this email already exists.');
        }
        updateData.email = normalized;
      }

      if (data.firstName !== undefined || data.lastName !== undefined) {
        const current = await tx.user.findUnique({
          where: { id: actor.id },
          select: { firstName: true, lastName: true },
        });
        const finalFirst = data.firstName !== undefined ? data.firstName.trim() : (current?.firstName ?? '');
        const finalLast = data.lastName !== undefined ? data.lastName.trim() : (current?.lastName ?? '');
        if (data.firstName !== undefined) updateData.firstName = finalFirst;
        if (data.lastName !== undefined) updateData.lastName = finalLast;
        updateData.fullName = `${finalFirst}${finalLast ? ` ${finalLast}` : ''}`.trim();
      }

      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: actor.id },
          data: updateData,
        });
      }

      // Handle skills
      if (data.skills !== undefined) {
        await tx.userSkill.deleteMany({ where: { userId: actor.id } });
        
        for (const skillName of data.skills) {
          const name = skillName.trim();
          if (!name) continue;
          
          let skill = await tx.skill.findUnique({
            where: {
              organizationId_name: {
                organizationId: actor.organizationId,
                name,
              },
            },
          });
          
          if (!skill) {
            skill = await tx.skill.create({
              data: {
                organizationId: actor.organizationId,
                name,
              },
            });
          }
          
          await tx.userSkill.create({
            data: {
              userId: actor.id,
              skillId: skill.id,
            },
          });
        }
      }

      // Handle research areas
      if (data.researchAreas !== undefined) {
        await tx.userResearchArea.deleteMany({ where: { userId: actor.id } });
        
        for (const areaName of data.researchAreas) {
          const name = areaName.trim();
          if (!name) continue;
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          
          let area = await tx.researchArea.findFirst({
            where: {
              organizationId: actor.organizationId,
              name,
            },
          });
          
          if (!area) {
            area = await tx.researchArea.create({
              data: {
                organizationId: actor.organizationId,
                name,
                slug: `${slug}-${Math.random().toString(36).substring(2, 8)}`,
              },
            });
          }
          
          await tx.userResearchArea.create({
            data: {
              userId: actor.id,
              researchAreaId: area.id,
            },
          });
        }
      }
    });
  }

  async changePassword(
    actor: AuthenticatedUser,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { passwordHash: true },
    });
    if (!user) throw new BadRequestException('User not found.');

    const valid = await compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new ForbiddenException('Current password is incorrect.');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters.');
    }

    const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash },
    });
  }

  async updateProfileDetails(
    actor: AuthenticatedUser,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      bio?: string;
      profileImageUrl?: string;
      skills?: string[];
      researchAreas?: string[];
    },
  ) {
    return this.updateProfile(actor, data);
  }

  async updateUserByAdmin(
    actor: AuthenticatedUser,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      bio?: string;
      profileImageUrl?: string;
      status?: UserStatus;
      password?: string;
    },
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!target || target.organizationId !== actor.organizationId) {
      throw new BadRequestException('User not found.');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const finalFirst = data.firstName !== undefined ? data.firstName.trim() : target.firstName;
      const finalLast = data.lastName !== undefined ? data.lastName.trim() : (target.lastName ?? '');
      if (data.firstName !== undefined) updateData.firstName = finalFirst;
      if (data.lastName !== undefined) updateData.lastName = finalLast;
      updateData.fullName = `${finalFirst}${finalLast ? ` ${finalLast}` : ''}`.trim();
    }

    if (data.email !== undefined && data.email.trim().toLowerCase() !== target.email.toLowerCase()) {
      const normalized = data.email.trim().toLowerCase();
      const existing = await this.prisma.user.findFirst({
        where: { email: normalized, id: { not: target.id } },
      });
      if (existing) {
        throw new ConflictException('A user with this email already exists.');
      }
      updateData.email = normalized;
    }

    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.password && data.password.trim().length > 0) {
      if (data.password.trim().length < 6) {
        throw new BadRequestException('Password must be at least 6 characters.');
      }
      updateData.passwordHash = await hash(data.password.trim(), BCRYPT_ROUNDS);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        memberCode: true,
        email: true,
        firstName: true,
        lastName: true,
        fullName: true,
        profileImageUrl: true,
        phone: true,
        bio: true,
        status: true,
      },
    });
  }

  async listAdmins(actor: AuthenticatedUser) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Only Super Admin can view admin management.',
      });
    }

    const adminRoles = await this.prisma.userRole.findMany({
      where: {
        role: { organizationId: actor.organizationId, code: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        user: { deletedAt: null },
      },
      include: {
        user: {
          select: {
            id: true,
            memberCode: true,
            email: true,
            firstName: true,
            lastName: true,
            fullName: true,
            profileImageUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            teamMemberships: {
              where: { isActive: true },
              include: { team: { select: { id: true, name: true, teamCode: true } } },
            },
          },
        },
        role: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const userMap = new Map<string, any>();
    for (const item of adminRoles) {
      const existing = userMap.get(item.user.id);
      if (existing) {
        if (!existing.roles.includes(item.role.code)) {
          existing.roles.push(item.role.code);
        }
      } else {
        userMap.set(item.user.id, {
          ...item.user,
          roles: [item.role.code],
          teams: item.user.teamMemberships.map((tm) => tm.team),
        });
      }
    }

    return Array.from(userMap.values());
  }

  async promoteToAdmin(actor: AuthenticatedUser, userId: string, roleCode: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN') {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Only Super Admin can assign admin roles.',
      });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException('User was not found.');
    }

    const role = await this.prisma.role.findFirst({
      where: { organizationId: actor.organizationId, code: roleCode },
    });
    if (!role) {
      throw new BadRequestException(`Role ${roleCode} not found in this organization.`);
    }

    const existingUserRole = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId: role.id } },
    });
    if (!existingUserRole) {
      await this.prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
          assignedBy: actor.id,
        },
      });
    }

    return { success: true, message: `User promoted to ${roleCode}` };
  }

  async demoteAdmin(actor: AuthenticatedUser, userId: string) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'Only Super Admin can revoke admin roles.',
      });
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });
    if (!target) {
      throw new NotFoundException('User was not found.');
    }

    const isSuperAdminTarget = target.userRoles.some((ur) => ur.role.code === 'SUPER_ADMIN');
    if (isSuperAdminTarget) {
      const superAdminCount = await this.prisma.userRole.count({
        where: {
          role: { organizationId: actor.organizationId, code: 'SUPER_ADMIN' },
          user: { status: UserStatus.ACTIVE, deletedAt: null },
        },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_SUPER_ADMIN_PROTECTED',
          message: 'Cannot demote the last active Super Admin.',
        });
      }
    }

    const adminRoles = target.userRoles.filter((ur) => ['SUPER_ADMIN', 'ADMIN'].includes(ur.role.code));
    if (adminRoles.length > 0) {
      await this.prisma.userRole.deleteMany({
        where: {
          userId,
          roleId: { in: adminRoles.map((ur) => ur.roleId) },
        },
      });
    }

    return { success: true, message: 'Admin role revoked successfully.' };
  }
}
