import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateProjectDto } from './dto/create-project.dto.js';
import { ListProjectsDto } from './dto/list-projects.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListProjectsDto,
  ) {
    const result = await this.projectsService.list(request.user, query);
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Get(':id')
  async getById(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const project = await this.projectsService.getById(request.user, id);
    return { success: true, data: project };
  }

  @Post()
  @RequirePermissions('PROJECT_MANAGE')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectsService.create(request.user, dto);
    return { success: true, data: project };
  }

  @Post(':id/teams')
  @RequirePermissions('PROJECT_MANAGE')
  async addTeams(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('teamIds') teamIds: string[],
  ) {
    await this.projectsService.addTeams(request.user, id, teamIds || []);
    return { success: true };
  }

  @Post(':id/teams/remove')
  @RequirePermissions('PROJECT_MANAGE')
  async removeTeams(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('teamIds') teamIds: string[],
  ) {
    await this.projectsService.removeTeams(request.user, id, teamIds || []);
    return { success: true };
  }

  @Post(':id/members')
  @RequirePermissions('PROJECT_MANAGE')
  async addMembers(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('memberIds') memberIds: string[],
  ) {
    await this.projectsService.addMembers(request.user, id, memberIds || []);
    return { success: true };
  }

  @Post(':id/members/remove')
  @RequirePermissions('PROJECT_MANAGE')
  async removeMembers(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('memberIds') memberIds: string[],
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.projectsService.removeMembers(request.user, id, memberIds || [], adminPassword);
    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions('PROJECT_MANAGE')
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.projectsService.delete(request.user, id, adminPassword);
    return { success: true };
  }

  @Post(':id/delete')
  @RequirePermissions('PROJECT_MANAGE')
  async deletePost(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.projectsService.delete(request.user, id, adminPassword);
    return { success: true };
  }
}
