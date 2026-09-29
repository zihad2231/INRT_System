import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import type { UpdateOrganizationDto } from './dto/update-organization.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(actor: AuthenticatedUser) {
    const org = await this.prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        description: true,
        email: true,
        phone: true,
        timezone: true,
        dateFormat: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization was not found.',
      });
    }

    return org;
  }

  async updateCurrent(actor: AuthenticatedUser, dto: UpdateOrganizationDto) {
    if (!actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role))) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_MANAGE_NOT_ALLOWED',
        message: 'Only organization administrators can update organization settings.',
      });
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: actor.organizationId },
    });

    if (!org) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization was not found.',
      });
    }

    const updated = await this.prisma.organization.update({
      where: { id: org.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email ? dto.email.trim() : null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone ? dto.phone.trim() : null } : {}),
        ...(dto.description !== undefined ? { description: dto.description ? dto.description.trim() : null } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.dateFormat !== undefined ? { dateFormat: dto.dateFormat.trim() } : {}),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        description: true,
        email: true,
        phone: true,
        timezone: true,
        dateFormat: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
