import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { ListTeamsDto } from './dto/list-teams.dto.js';
import { TeamsService } from './teams.service.js';

@Controller('teams')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTeamsDto,
  ) {
    const result = await this.teamsService.list(request.user, query);
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Get(':id')
  async getById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const team = await this.teamsService.getById(request.user, id);
    return { success: true, data: team };
  }

  @Post()
  @RequirePermissions('TEAM_CREATE')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTeamDto,
  ) {
    const team = await this.teamsService.create(request.user, dto);
    return { success: true, data: team };
  }

  @Post(':id/members')
  @RequirePermissions('TEAM_MANAGE')
  async addMembers(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('memberIds') memberIds: string[],
  ) {
    await this.teamsService.addMembers(request.user, id, memberIds || []);
    return { success: true };
  }

  @Post(':id/members/remove')
  @RequirePermissions('TEAM_MANAGE')
  async removeMembers(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('memberIds') memberIds: string[],
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.teamsService.removeMembers(request.user, id, memberIds || [], adminPassword);
    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions('TEAM_MANAGE')
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.teamsService.delete(request.user, id, adminPassword);
    return { success: true };
  }

  @Post(':id/delete')
  @RequirePermissions('TEAM_MANAGE')
  async deletePost(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.teamsService.delete(request.user, id, adminPassword);
    return { success: true };
  }

  @Patch(':id/leader')
  @RequirePermissions('TEAM_MANAGE')
  async assignLeaderPatch(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('leaderId') leaderId?: string | null,
  ) {
    const updated = await this.teamsService.assignLeader(request.user, id, leaderId ?? null);
    return { success: true, data: updated };
  }

  @Post(':id/leader')
  @RequirePermissions('TEAM_MANAGE')
  async assignLeader(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('leaderId') leaderId?: string | null,
  ) {
    const updated = await this.teamsService.assignLeader(request.user, id, leaderId ?? null);
    return { success: true, data: updated };
  }
}
