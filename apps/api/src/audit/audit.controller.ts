import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('audit')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('AUDIT_VIEW')
  async getAuditLogs(
    @Req() request: AuthenticatedRequest,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(1, parseInt(pageStr || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(limitStr || '20', 10)));

    const where = { organizationId: request.user.organizationId };

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, fullName: true, memberCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        data: records,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    };
  }
}
