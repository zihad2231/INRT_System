import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { AddProjectPaperDto } from './dto/add-project-paper.dto.js';
import { ListPapersDto } from './dto/list-papers.dto.js';
import { PapersService } from './papers.service.js';

@Controller('projects/:projectId/papers')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Query() query: ListPapersDto,
  ) {
    const result = await this.papersService.listProjectPapers(
      request.user,
      projectId,
      query,
    );
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Post()
  async add(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectPaperDto,
  ) {
    const result = await this.papersService.addToProject(
      request.user,
      projectId,
      dto,
    );
    return { success: true, data: result };
  }

  @Post(':paperId/assignments')
  async assign(
    @Req() request: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('paperId') paperId: string,
    @Body('userId') userId: string,
  ) {
    const assignment = await this.papersService.assignPrimaryReader(
      request.user,
      projectId,
      paperId,
      userId,
    );
    return { success: true, data: assignment };
  }
}
