import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    organizationId: string,
    event: string,
    title: string,
    message: string,
    entityType?: string,
    entityId?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        organizationId,
        type: 'IN_APP',
        event,
        title,
        message,
        entityType,
        entityId,
      },
    });
  }

  async getUserNotifications(
    userId: string,
    organizationId: string,
    query: { unreadOnly?: boolean; page?: number; limit?: number } = {},
  ) {
    const { unreadOnly = false, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      organizationId,
    };

    if (unreadOnly) {
      where.readAt = null;
    }

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string, organizationId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        organizationId,
        readAt: null,
      },
    });
  }

  async markAsRead(id: string, userId: string, organizationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId, organizationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, organizationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { count: result.count };
  }
}
