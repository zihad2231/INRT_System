import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetCondition, AssetStatus, Prisma, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignAssetDto } from './dto/assign-asset.dto.js';
import type { CreateAssetDto } from './dto/create-asset.dto.js';
import type { ListAssetsDto } from './dto/list-assets.dto.js';
import type { ReturnAssetDto } from './dto/return-asset.dto.js';

const assetInclude = {
  assignments: {
    where: { returnedAt: null },
    include: { user: { select: { id: true, memberCode: true, fullName: true } }, team: { select: { id: true, teamCode: true, name: true } } },
    take: 1,
  },
  _count: { select: { assignments: true } },
} satisfies Prisma.AssetInclude;

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireManage(actor: AuthenticatedUser) {
    if (!actor.permissions.includes('ASSET_MANAGE') && !actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role))) {
      throw new ForbiddenException({ code: 'ASSET_MANAGE_NOT_ALLOWED', message: 'You are not allowed to manage assets.' });
    }
  }

  async list(actor: AuthenticatedUser, query: ListAssetsDto) {
    const where: Prisma.AssetWhereInput = { organizationId: actor.organizationId, deletedAt: null, ...(query.status ? { status: query.status } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.asset.findMany({ where, include: assetInclude, orderBy: { createdAt: 'desc' }, skip: ((query.page ?? 1) - 1) * (query.limit ?? 20), take: query.limit ?? 20 }),
      this.prisma.asset.count({ where }),
    ]);
    return { data, meta: { page: query.page ?? 1, limit: query.limit ?? 20, total, totalPages: Math.ceil(total / (query.limit ?? 20)) } };
  }

  async create(actor: AuthenticatedUser, dto: CreateAssetDto) {
    this.requireManage(actor);
    try {
      return await this.prisma.asset.create({ data: { organizationId: actor.organizationId, assetCode: dto.assetCode.trim(), name: dto.name.trim(), category: dto.category.trim(), description: dto.description?.trim() || null, serialNumber: dto.serialNumber?.trim() || null, purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null, purchasePrice: dto.purchasePrice, condition: dto.condition ?? AssetCondition.NEW, location: dto.location?.trim() || null, createdBy: actor.id }, include: assetInclude });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ code: 'ASSET_CODE_ALREADY_EXISTS', message: 'An asset with this code already exists.' });
      throw error;
    }
  }

  async assign(actor: AuthenticatedUser, assetId: string, dto: AssignAssetDto) {
    this.requireManage(actor);
    if (!dto.userId && !dto.teamId) throw new BadRequestException({ code: 'ASSET_TARGET_REQUIRED', message: 'Assign the asset to a user or team.' });
    if (dto.userId && dto.teamId) throw new BadRequestException({ code: 'ASSET_SINGLE_TARGET_REQUIRED', message: 'Assign the asset to either a user or team, not both.' });
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: actor.organizationId, deletedAt: null }, select: { id: true, status: true } });
    if (!asset) throw this.notFound();
    if (asset.status !== AssetStatus.AVAILABLE) throw new ConflictException({ code: 'ASSET_NOT_AVAILABLE', message: 'This asset is not available for assignment.' });
    if (dto.userId) {
      const user = await this.prisma.user.findFirst({ where: { id: dto.userId, organizationId: actor.organizationId, status: UserStatus.ACTIVE, deletedAt: null }, select: { id: true } });
      if (!user) throw new BadRequestException({ code: 'INVALID_ASSET_USER', message: 'User is not active in this organization.' });
    }
    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({ where: { id: dto.teamId, organizationId: actor.organizationId, deletedAt: null }, select: { id: true } });
      if (!team) throw new BadRequestException({ code: 'INVALID_ASSET_TEAM', message: 'Team is not available in this organization.' });
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.asset.update({ where: { id: assetId }, data: { status: AssetStatus.IN_USE, condition: dto.conditionOnAssignment } });
      return tx.assetAssignment.create({ data: { assetId, userId: dto.userId, teamId: dto.teamId, assignedBy: actor.id, conditionOnAssignment: dto.conditionOnAssignment, notes: dto.notes?.trim() || null }, include: { user: { select: { id: true, memberCode: true, fullName: true } }, team: { select: { id: true, teamCode: true, name: true } } } });
    });
  }

  async returnAsset(actor: AuthenticatedUser, assetId: string, dto: ReturnAssetDto) {
    this.requireManage(actor);
    const assignment = await this.prisma.assetAssignment.findFirst({ where: { assetId, asset: { organizationId: actor.organizationId }, returnedAt: null }, orderBy: { assignedAt: 'desc' }, select: { id: true } });
    if (!assignment) throw new NotFoundException({ code: 'ACTIVE_ASSET_ASSIGNMENT_NOT_FOUND', message: 'No active assignment was found for this asset.' });
    return this.prisma.$transaction(async (tx) => {
      await tx.assetAssignment.update({ where: { id: assignment.id }, data: { returnedAt: new Date(), conditionOnReturn: dto.conditionOnReturn, notes: dto.notes?.trim() || undefined } });
      return tx.asset.update({ where: { id: assetId }, data: { status: AssetStatus.AVAILABLE, condition: dto.conditionOnReturn }, include: assetInclude });
    });
  }

  async history(actor: AuthenticatedUser, assetId: string) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, organizationId: actor.organizationId, deletedAt: null }, select: { id: true } });
    if (!asset) throw this.notFound();
    return this.prisma.assetAssignment.findMany({ where: { assetId }, orderBy: { assignedAt: 'desc' }, include: { user: { select: { id: true, memberCode: true, fullName: true } }, team: { select: { id: true, teamCode: true, name: true } } } });
  }

  private notFound() { return new NotFoundException({ code: 'ASSET_NOT_FOUND', message: 'Asset was not found.' }); }
}
