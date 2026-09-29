import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { ImageBbService, type UploadedImageFile } from './imagebb.service.js';

@Injectable()
export class OrganizationLogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageBb: ImageBbService,
  ) {}

  async upload(actor: AuthenticatedUser, file: UploadedImageFile) {
    if (!actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role))) {
      throw new ForbiddenException({
        code: 'ORGANIZATION_LOGO_MANAGE_NOT_ALLOWED',
        message: 'Only organization administrators can change the company logo.',
      });
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: actor.organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Organization was not found.',
      });
    }

    const uploaded = await this.imageBb.upload(file);
    return this.prisma.organization.update({
      where: { id: organization.id },
      data: { logoUrl: uploaded.url },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }
}
