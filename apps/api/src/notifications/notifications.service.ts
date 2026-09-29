import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    organizationId: string;
    userId: string;
    title: string;
    content: string;
    type: string;
    referenceId?: string;
    referenceType?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        title: data.title,
        content: data.content,
        type: data.type,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
      },
    });
  }

  async getUnreadForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
