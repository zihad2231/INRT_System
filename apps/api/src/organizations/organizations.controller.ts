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
@UseGuards(SessionAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  async getCurrent(@Req() request: AuthenticatedRequest) {
    const data = await this.organizationsService.getCurrent(request.user);
    return { success: true, data };
  }

  @Patch('current')
  async updateCurrent(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const data = await this.organizationsService.updateCurrent(request.user, dto);
    return { success: true, data };
  }
}
