import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getMyNotifications(@Req() request: AuthenticatedRequest) {
    const notifications = await this.notificationsService.getUnreadForUser(
      request.user.id,
    );
    return { success: true, data: notifications };
  }

  @Patch(':id/read')
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.notificationsService.markAsRead(request.user.id, id);
    return { success: true };
  }

  @Patch('read-all')
  async markAllRead(@Req() request: AuthenticatedRequest) {
    await this.notificationsService.markAllAsRead(request.user.id);
    return { success: true };
  }
}
