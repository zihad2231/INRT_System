import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { ListAssetsDto } from './dto/list-assets.dto.js';
import { AssignAssetDto } from './dto/assign-asset.dto.js';
import { ReturnAssetDto } from './dto/return-asset.dto.js';
import { AssetsService } from './assets.service.js';

@Controller('assets')
@UseGuards(SessionAuthGuard)
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListAssetsDto) { return { success: true, data: await this.assets.list(request.user, query) }; }
  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateAssetDto) { return { success: true, data: await this.assets.create(request.user, dto) }; }
  @Post(':id/assign')
  async assign(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignAssetDto) { return { success: true, data: await this.assets.assign(request.user, id, dto) }; }
  @Patch(':id/return')
  async returnAsset(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReturnAssetDto) { return { success: true, data: await this.assets.returnAsset(request.user, id, dto) }; }
  @Get(':id/history')
  async history(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) { return { success: true, data: await this.assets.history(request.user, id) }; }
}
