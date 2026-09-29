import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { OrganizationsService } from './organizations.service.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('public')
  async getPublicBranding() {
    const data = await this.organizationsService.getPublicBranding();
    return { success: true, data };
  }

  @Get('current')
  @UseGuards(SessionAuthGuard)
  async getCurrent(@Req() request: AuthenticatedRequest) {
    const data = await this.organizationsService.getCurrent(request.user);
    return { success: true, data };
  }

  @Patch('current')
  @UseGuards(SessionAuthGuard)
  async updateCurrent(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const data = await this.organizationsService.updateCurrent(request.user, dto);
    return { success: true, data };
  }
}
