import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateNoticeDto } from './dto/create-notice.dto.js';
import { ListNoticesDto } from './dto/list-notices.dto.js';
import { NoticesService } from './notices.service.js';

@Controller('notices')
@UseGuards(SessionAuthGuard)
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListNoticesDto,
  ) {
    const result = await this.noticesService.listVisible(request.user, query);
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateNoticeDto,
  ) {
    const notice = await this.noticesService.create(request.user, dto);
    return { success: true, data: notice };
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const acknowledgement = await this.noticesService.acknowledge(request.user, id);
    return { success: true, data: acknowledgement };
  }

  @Get(':id/acknowledgements')
  async acknowledgementSummary(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const summary = await this.noticesService.acknowledgementSummary(request.user, id);
    return { success: true, data: summary };
  }
}
