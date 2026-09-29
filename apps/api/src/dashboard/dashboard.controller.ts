import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('member')
  async member(@Req() request: AuthenticatedRequest) {
    return { success: true, data: await this.dashboard.getMemberDashboard(request.user) };
  }
}