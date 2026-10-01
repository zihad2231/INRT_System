import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ComponentAllocationStatus,
  ComponentRequestStatus,
  ComponentStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateComponentRequestDto } from './dto/create-component-request.dto.js';
import type { CreateComponentDto } from './dto/create-component.dto.js';
import type { ListComponentAllocationsDto } from './dto/list-component-allocations.dto.js';
import type { ListComponentRequestsDto } from './dto/list-component-requests.dto.js';
import type { ListComponentsDto } from './dto/list-components.dto.js';
import type { ReturnComponentAllocationDto } from './dto/return-component-allocation.dto.js';
import type { ReviewComponentRequestDto } from './dto/review-component-request.dto.js';
import type { UpdateComponentDto } from './dto/update-component.dto.js';

const componentInclude = {
  creator: { select: { id: true, memberCode: true, fullName: true } },
  _count: { select: { requests: true, allocations: true } },
} satisfies Prisma.ComponentInclude;

@Injectable()
export class ComponentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private requireAdmin(actor: AuthenticatedUser) {
    const isAdmin =
      actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r)) ||
      actor.permissions.includes('COMPONENT_MANAGE');
    if (!isAdmin) {
      throw new ForbiddenException({
        code: 'COMPONENT_MANAGE_NOT_ALLOWED',
        message: 'Only admins are allowed to manage component inventory and requests.',
      });
    }
  }

  private deriveStatus(total: number, available: number): ComponentStatus {
    if (total <= 0) return ComponentStatus.UNAVAILABLE;
    if (available === total) return ComponentStatus.AVAILABLE;
    if (available === 0) return ComponentStatus.IN_USE;
    return ComponentStatus.PARTIALLY_AVAILABLE;
  }

  async listComponents(actor: AuthenticatedUser, query: ListComponentsDto) {
    const where: Prisma.ComponentWhereInput = {
      organizationId: actor.organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { componentCode: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              { brand: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.component.findMany({
        where,
        include: componentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.component.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getComponent(actor: AuthenticatedUser, id: string) {
    const component = await this.prisma.component.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
      include: {
        creator: { select: { id: true, memberCode: true, fullName: true } },
        allocations: {
          where: { status: ComponentAllocationStatus.ACTIVE },
          include: {
            user: { select: { id: true, memberCode: true, fullName: true } },
            project: { select: { id: true, projectCode: true, title: true } },
            team: { select: { id: true, teamCode: true, name: true } },
          },
          orderBy: { startDate: 'desc' },
        },
        requests: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            requester: { select: { id: true, memberCode: true, fullName: true } },
            project: { select: { id: true, projectCode: true, title: true } },
          },
        },
        _count: { select: { requests: true, allocations: true } },
      },
    });

    if (!component) {
      throw new NotFoundException({
        code: 'COMPONENT_NOT_FOUND',
        message: 'Component was not found.',
      });
    }

    return component;
  }

  async generateComponentCode(organizationId: string, name: string, category?: string): Promise<string> {
    const rawSource = (name || category || 'CMP').replace(/[^a-zA-Z0-9]/g, '').trim();
    let prefix = rawSource.slice(0, 3).toUpperCase();
    if (prefix.length < 3) {
      prefix = (prefix + 'CMP').slice(0, 3).toUpperCase();
    }

    const existingComponents = await this.prisma.component.findMany({
      where: {
        organizationId,
        componentCode: { startsWith: prefix, mode: 'insensitive' },
      },
      select: { componentCode: true },
    });

    let maxNum = 0;
    const regex = new RegExp(`^${prefix}(\\d+)$`, 'i');
    for (const c of existingComponents) {
      const match = c.componentCode.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const paddedNum = String(nextNum).padStart(3, '0');
    return `${prefix}${paddedNum}`;
  }

  async generateCodeForClient(actor: AuthenticatedUser, name: string, category?: string) {
    return { code: await this.generateComponentCode(actor.organizationId, name, category) };
  }

  async createComponent(actor: AuthenticatedUser, dto: CreateComponentDto) {
    this.requireAdmin(actor);

    let finalCode = dto.componentCode?.trim();
    if (!finalCode) {
      finalCode = await this.generateComponentCode(actor.organizationId, dto.name, dto.category);
    } else {
      const existingCode = await this.prisma.component.findFirst({
        where: {
          organizationId: actor.organizationId,
          componentCode: finalCode,
          deletedAt: null,
        },
      });

      if (existingCode) {
        throw new ConflictException({
          code: 'COMPONENT_CODE_EXISTS',
          message: `Component code '${finalCode}' already exists in your organization.`,
        });
      }
    }

    const totalQuantity = dto.totalQuantity;
    const availableQuantity = totalQuantity;
    const allocatedQuantity = 0;
    const status = this.deriveStatus(totalQuantity, availableQuantity);

    const component = await this.prisma.component.create({
      data: {
        organizationId: actor.organizationId,
        componentCode: finalCode,
        name: dto.name.trim(),
        category: dto.category.trim(),
        description: dto.description?.trim() || null,
        imageUrl: dto.imageUrl?.trim() || null,
        totalQuantity,
        availableQuantity,
        allocatedQuantity,
        status,
        brand: dto.brand?.trim() || null,
        model: dto.model?.trim() || null,
        unitPrice: dto.unitPrice ?? null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        location: dto.location?.trim() || null,
        condition: dto.condition?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdBy: actor.id,
      },
      include: componentInclude,
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entity: 'Component',
      entityId: component.id,
      newValue: component,
    });

    return component;
  }

  async updateComponent(actor: AuthenticatedUser, id: string, dto: UpdateComponentDto) {
    this.requireAdmin(actor);

    const existing = await this.prisma.component.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'COMPONENT_NOT_FOUND',
        message: 'Component was not found.',
      });
    }

    let newTotal = existing.totalQuantity;
    let newAvailable = existing.availableQuantity;
    let newAllocated = existing.allocatedQuantity;

    if (dto.totalQuantity !== undefined) {
      if (dto.totalQuantity < existing.allocatedQuantity) {
        throw new BadRequestException({
          code: 'TOTAL_LESS_THAN_ALLOCATED',
          message: `Total quantity (${dto.totalQuantity}) cannot be less than currently allocated quantity (${existing.allocatedQuantity}).`,
        });
      }
      newTotal = dto.totalQuantity;
      newAvailable = newTotal - newAllocated;
    }

    const newStatus = this.deriveStatus(newTotal, newAvailable);

    const updated = await this.prisma.component.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? existing.name,
        category: dto.category?.trim() ?? existing.category,
        description: dto.description !== undefined ? dto.description?.trim() || null : existing.description,
        imageUrl: dto.imageUrl !== undefined ? dto.imageUrl?.trim() || null : existing.imageUrl,
        totalQuantity: newTotal,
        availableQuantity: newAvailable,
        status: newStatus,
        brand: dto.brand !== undefined ? dto.brand?.trim() || null : existing.brand,
        model: dto.model !== undefined ? dto.model?.trim() || null : existing.model,
        unitPrice: dto.unitPrice !== undefined ? dto.unitPrice : existing.unitPrice,
        purchaseDate: dto.purchaseDate !== undefined ? (dto.purchaseDate ? new Date(dto.purchaseDate) : null) : existing.purchaseDate,
        location: dto.location !== undefined ? dto.location?.trim() || null : existing.location,
        condition: dto.condition !== undefined ? dto.condition?.trim() || null : existing.condition,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : existing.notes,
      },
      include: componentInclude,
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'Component',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });

    return updated;
  }

  async deleteComponent(actor: AuthenticatedUser, id: string) {
    this.requireAdmin(actor);

    const existing = await this.prisma.component.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'COMPONENT_NOT_FOUND',
        message: 'Component was not found.',
      });
    }

    if (existing.allocatedQuantity > 0) {
      throw new ConflictException({
        code: 'COMPONENT_IN_USE',
        message: `Cannot delete component '${existing.name}' because it has ${existing.allocatedQuantity} active allocation(s). Please return all allocations before deleting.`,
      });
    }

    const updated = await this.prisma.component.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.DELETE,
      entity: 'Component',
      entityId: id,
      oldValue: existing,
    });

    return { success: true, message: 'Component archived successfully.' };
  }

  async createRequest(actor: AuthenticatedUser, dto: CreateComponentRequestDto) {
    const component = await this.prisma.component.findFirst({
      where: {
        id: dto.componentId,
        organizationId: actor.organizationId,
        deletedAt: null,
      },
    });

    if (!component) {
      throw new NotFoundException({
        code: 'COMPONENT_NOT_FOUND',
        message: 'Component was not found.',
      });
    }

    if (dto.requestedQuantity > component.availableQuantity) {
      throw new BadRequestException({
        code: 'REQUEST_EXCEEDS_AVAILABLE',
        message: `Requested quantity (${dto.requestedQuantity}) exceeds currently available quantity (${component.availableQuantity}).`,
      });
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId: actor.organizationId, deletedAt: null },
      });
      if (!project) {
        throw new BadRequestException({
          code: 'PROJECT_NOT_FOUND',
          message: 'Specified project was not found in your organization.',
        });
      }
    }

    const request = await this.prisma.componentRequest.create({
      data: {
        organizationId: actor.organizationId,
        componentId: dto.componentId,
        requestedBy: actor.id,
        projectId: dto.projectId || null,
        requestedQuantity: dto.requestedQuantity,
        purpose: dto.purpose.trim(),
        expectedStartDate: dto.expectedStartDate ? new Date(dto.expectedStartDate) : null,
        expectedEndDate: dto.expectedEndDate ? new Date(dto.expectedEndDate) : null,
        additionalNote: dto.additionalNote?.trim() || null,
        status: ComponentRequestStatus.PENDING,
      },
      include: {
        component: { select: { id: true, componentCode: true, name: true, category: true, imageUrl: true } },
        requester: { select: { id: true, memberCode: true, fullName: true } },
        project: { select: { id: true, projectCode: true, title: true } },
      },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.CREATE,
      entity: 'ComponentRequest',
      entityId: request.id,
      newValue: request,
    });

    return request;
  }

  async listRequests(actor: AuthenticatedUser, query: ListComponentRequestsDto) {
    const isAdmin =
      actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r)) ||
      actor.permissions.includes('COMPONENT_MANAGE');

    const where: Prisma.ComponentRequestWhereInput = {
      organizationId: actor.organizationId,
      ...(!isAdmin ? { requestedBy: actor.id } : query.requestedBy ? { requestedBy: query.requestedBy } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.componentId ? { componentId: query.componentId } : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.componentRequest.findMany({
        where,
        include: {
          component: { select: { id: true, componentCode: true, name: true, category: true, imageUrl: true } },
          requester: { select: { id: true, memberCode: true, fullName: true, email: true } },
          reviewer: { select: { id: true, memberCode: true, fullName: true } },
          project: { select: { id: true, projectCode: true, title: true } },
          allocation: { select: { id: true, status: true, startDate: true, expectedEndDate: true, actualReturnDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.componentRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveRequest(actor: AuthenticatedUser, id: string, dto: ReviewComponentRequestDto) {
    this.requireAdmin(actor);

    const request = await this.prisma.componentRequest.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { component: true, requester: true },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Component request was not found.',
      });
    }

    if (request.status !== ComponentRequestStatus.PENDING) {
      throw new BadRequestException({
        code: 'REQUEST_ALREADY_PROCESSED',
        message: `Request is already in '${request.status}' state and cannot be approved.`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const component = await tx.component.findFirst({
        where: { id: request.componentId, deletedAt: null },
      });

      if (!component) {
        throw new NotFoundException({
          code: 'COMPONENT_NOT_FOUND',
          message: 'Component linked to this request was not found or has been deleted.',
        });
      }

      if (component.availableQuantity < request.requestedQuantity) {
        throw new ConflictException({
          code: 'INSUFFICIENT_QUANTITY',
          message: `Cannot approve request. Available quantity (${component.availableQuantity}) is less than requested (${request.requestedQuantity}).`,
        });
      }

      const newAvailable = component.availableQuantity - request.requestedQuantity;
      const newAllocated = component.allocatedQuantity + request.requestedQuantity;
      const newStatus = this.deriveStatus(component.totalQuantity, newAvailable);

      await tx.component.update({
        where: { id: component.id },
        data: {
          availableQuantity: newAvailable,
          allocatedQuantity: newAllocated,
          status: newStatus,
        },
      });

      const updatedRequest = await tx.componentRequest.update({
        where: { id },
        data: {
          status: ComponentRequestStatus.APPROVED,
          reviewedBy: actor.id,
          reviewedAt: new Date(),
          reviewComment: dto.comment?.trim() || null,
        },
      });

      const allocation = await tx.componentAllocation.create({
        data: {
          organizationId: actor.organizationId,
          componentId: request.componentId,
          requestId: request.id,
          projectId: request.projectId,
          userId: request.requestedBy,
          quantity: request.requestedQuantity,
          startDate: request.expectedStartDate || new Date(),
          expectedEndDate: request.expectedEndDate,
          status: ComponentAllocationStatus.ACTIVE,
          allocatedBy: actor.id,
          notes: dto.comment?.trim() || `Approved from request #${request.id.slice(0, 8)}`,
        },
      });

      await this.notifications.create({
        organizationId: actor.organizationId,
        userId: request.requestedBy,
        title: 'Component Request Approved',
        content: `Your request for ${request.requestedQuantity}x '${component.name}' has been approved.`,
        type: 'COMPONENT_REQUEST_APPROVED',
        referenceId: request.id,
        referenceType: 'ComponentRequest',
      });

      await this.audit.log({
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: AuditAction.UPDATE,
        entity: 'ComponentRequest',
        entityId: request.id,
        oldValue: { status: ComponentRequestStatus.PENDING },
        newValue: { status: ComponentRequestStatus.APPROVED, allocationId: allocation.id },
      });

      return { request: updatedRequest, allocation };
    });
  }

  async rejectRequest(actor: AuthenticatedUser, id: string, dto: ReviewComponentRequestDto) {
    this.requireAdmin(actor);

    const request = await this.prisma.componentRequest.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { component: { select: { name: true } } },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Component request was not found.',
      });
    }

    if (request.status !== ComponentRequestStatus.PENDING) {
      throw new BadRequestException({
        code: 'REQUEST_ALREADY_PROCESSED',
        message: `Request is already in '${request.status}' state and cannot be rejected.`,
      });
    }

    const updatedRequest = await this.prisma.componentRequest.update({
      where: { id },
      data: {
        status: ComponentRequestStatus.REJECTED,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        reviewComment: dto.comment?.trim() || null,
      },
      include: {
        component: { select: { id: true, name: true } },
        requester: { select: { id: true, fullName: true } },
      },
    });

    await this.notifications.create({
      organizationId: actor.organizationId,
      userId: request.requestedBy,
      title: 'Component Request Rejected',
      content: `Your request for ${request.requestedQuantity}x '${request.component.name}' was rejected.${
        dto.comment ? ` Reason: ${dto.comment}` : ''
      }`,
      type: 'COMPONENT_REQUEST_REJECTED',
      referenceId: request.id,
      referenceType: 'ComponentRequest',
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'ComponentRequest',
      entityId: request.id,
      oldValue: { status: ComponentRequestStatus.PENDING },
      newValue: { status: ComponentRequestStatus.REJECTED },
    });

    return updatedRequest;
  }

  async cancelRequest(actor: AuthenticatedUser, id: string) {
    const request = await this.prisma.componentRequest.findFirst({
      where: { id, organizationId: actor.organizationId },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Component request was not found.',
      });
    }

    if (request.requestedBy !== actor.id) {
      throw new ForbiddenException({
        code: 'NOT_REQUEST_OWNER',
        message: 'You can only cancel your own component requests.',
      });
    }

    if (request.status !== ComponentRequestStatus.PENDING) {
      throw new BadRequestException({
        code: 'CANNOT_CANCEL',
        message: `Only PENDING requests can be cancelled. Current status: ${request.status}`,
      });
    }

    const updated = await this.prisma.componentRequest.update({
      where: { id },
      data: { status: ComponentRequestStatus.CANCELLED },
    });

    await this.audit.log({
      organizationId: actor.organizationId,
      actorId: actor.id,
      action: AuditAction.UPDATE,
      entity: 'ComponentRequest',
      entityId: id,
      oldValue: { status: ComponentRequestStatus.PENDING },
      newValue: { status: ComponentRequestStatus.CANCELLED },
    });

    return updated;
  }

  async listAllocations(actor: AuthenticatedUser, query: ListComponentAllocationsDto) {
    const isAdmin =
      actor.roles.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r)) ||
      actor.permissions.includes('COMPONENT_MANAGE');

    const where: Prisma.ComponentAllocationWhereInput = {
      organizationId: actor.organizationId,
      ...(!isAdmin ? { userId: actor.id } : query.userId ? { userId: query.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.componentId ? { componentId: query.componentId } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [data, total] = await Promise.all([
      this.prisma.componentAllocation.findMany({
        where,
        include: {
          component: { select: { id: true, componentCode: true, name: true, category: true, imageUrl: true } },
          user: { select: { id: true, memberCode: true, fullName: true, email: true } },
          team: { select: { id: true, teamCode: true, name: true } },
          project: { select: { id: true, projectCode: true, title: true } },
          allocator: { select: { id: true, memberCode: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.componentAllocation.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async returnAllocation(actor: AuthenticatedUser, id: string, dto: ReturnComponentAllocationDto) {
    this.requireAdmin(actor);

    const allocation = await this.prisma.componentAllocation.findFirst({
      where: { id, organizationId: actor.organizationId },
      include: { component: true },
    });

    if (!allocation) {
      throw new NotFoundException({
        code: 'ALLOCATION_NOT_FOUND',
        message: 'Component allocation was not found.',
      });
    }

    if (allocation.status !== ComponentAllocationStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'ALLOCATION_NOT_ACTIVE',
        message: `Allocation is currently in '${allocation.status}' state and cannot be returned.`,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const component = await tx.component.findFirst({
        where: { id: allocation.componentId, deletedAt: null },
      });

      if (!component) {
        throw new NotFoundException({
          code: 'COMPONENT_NOT_FOUND',
          message: 'Component linked to this allocation was not found.',
        });
      }

      const newAvailable = component.availableQuantity + allocation.quantity;
      const newAllocated = Math.max(0, component.allocatedQuantity - allocation.quantity);
      const newStatus = this.deriveStatus(component.totalQuantity, newAvailable);

      await tx.component.update({
        where: { id: component.id },
        data: {
          availableQuantity: newAvailable,
          allocatedQuantity: newAllocated,
          status: newStatus,
        },
      });

      const updatedAllocation = await tx.componentAllocation.update({
        where: { id },
        data: {
          status: ComponentAllocationStatus.RETURNED,
          actualReturnDate: new Date(),
          notes: dto.notes?.trim() ? `${allocation.notes ? `${allocation.notes}\n` : ''}Return note: ${dto.notes.trim()}` : allocation.notes,
        },
        include: {
          component: { select: { id: true, componentCode: true, name: true } },
          user: { select: { id: true, memberCode: true, fullName: true } },
        },
      });

      if (allocation.requestId) {
        await tx.componentRequest.update({
          where: { id: allocation.requestId },
          data: { status: ComponentRequestStatus.RETURNED },
        }).catch(() => null);
      }

      if (allocation.userId) {
        await this.notifications.create({
          organizationId: actor.organizationId,
          userId: allocation.userId,
          title: 'Component Allocation Released/Returned',
          content: `${allocation.quantity}x '${component.name}' allocation has been marked as returned.`,
          type: 'COMPONENT_RETURNED',
          referenceId: allocation.id,
          referenceType: 'ComponentAllocation',
        });
      }

      await this.audit.log({
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: AuditAction.UPDATE,
        entity: 'ComponentAllocation',
        entityId: id,
        oldValue: { status: ComponentAllocationStatus.ACTIVE },
        newValue: { status: ComponentAllocationStatus.RETURNED },
      });

      return updatedAllocation;
    });
  }
}
