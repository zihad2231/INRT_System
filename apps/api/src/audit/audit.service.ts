import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    organizationId: string;
    actorId?: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: params.organizationId,
          actorId: params.actorId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          oldValue: params.oldValue,
          newValue: params.newValue,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${params.entity} ${params.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
