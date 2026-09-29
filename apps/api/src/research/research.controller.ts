import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateQuestionSetDto } from './dto/create-question-set.dto.js';
import { ReviewResearchDto, SubmitResearchDto } from './dto/submit-research.dto.js';
import { ResearchService } from './research.service.js';

@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Post('question-sets')
  @RequirePermissions('PROJECT_MANAGE')
  async createQuestionSet(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateQuestionSetDto,
  ) {
    const questionSet = await this.researchService.createQuestionSet(request.user, dto);
    return { success: true, data: questionSet };
  }

  @Get('projects/:projectId/questions')
  async listProjectQuestions(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const data = await this.researchService.listProjectQuestions(request.user, projectId);
    return { success: true, data };
  }

  @Post('projects/:projectId/question-sets/:questionSetId')
  @RequirePermissions('PROJECT_MANAGE')
  async assignQuestionSet(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('questionSetId', ParseUUIDPipe) questionSetId: string,
  ) {
    const data = await this.researchService.assignQuestionSet(
      request.user,
      projectId,
      questionSetId,
    );
    return { success: true, data };
  }

  @Post('projects/:projectId/papers/:paperId/research-responses')
  async saveResponses(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('paperId', ParseUUIDPipe) paperId: string,
    @Body() dto: SubmitResearchDto,
  ) {
    const data = await this.researchService.saveResponses(
      request.user,
      projectId,
      paperId,
      dto,
    );
    return { success: true, data };
  }

  @Get('projects/:projectId/papers/:paperId/research-responses')
  async getResponses(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('paperId', ParseUUIDPipe) paperId: string,
  ) {
    const data = await this.researchService.getResponses(
      request.user,
      projectId,
      paperId,
    );
    return { success: true, data };
  }

  @Post('projects/:projectId/research-submissions/:submissionId/approve')
  @RequirePermissions('PAPER_REVIEW')
  async approveSubmission(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReviewResearchDto,
  ) {
    const data = await this.researchService.reviewSubmission(
      request.user,
      projectId,
      submissionId,
      dto,
      true,
    );
    return { success: true, data };
  }

  @Post('projects/:projectId/research-submissions/:submissionId/request-revision')
  @RequirePermissions('PAPER_REVIEW')
  async requestRevision(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: ReviewResearchDto,
  ) {
    const data = await this.researchService.reviewSubmission(
      request.user,
      projectId,
      submissionId,
      dto,
      false,
    );
    return { success: true, data };
  }
}
