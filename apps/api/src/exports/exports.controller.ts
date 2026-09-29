import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { ExportsService } from './exports.service.js';

@Controller('exports')
@UseGuards(SessionAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get()
  async getMyExports(@Req() request: AuthenticatedRequest) {
    const jobs = await this.exportsService.getMyJobs(
      request.user.organizationId,
      request.user.id,
    );
    return { success: true, data: jobs };
  }

  @Post()
  async requestExport(
    @Req() request: AuthenticatedRequest,
    @Body() body: { jobType: string; parameters: any },
  ) {
    if (!body.jobType) {
      throw new BadRequestException('jobType is required');
    }
    const job = await this.exportsService.requestExport(
      request.user.organizationId,
      request.user.id,
      body.jobType,
      body.parameters || {},
    );
    return { success: true, data: job };
  }
}
