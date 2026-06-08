import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Activity } from '@prisma/client';
import { requestContextStorage } from '../common/request-context';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(
    organizationId: string,
    actorId: string | null,
    entityType: string,
    entityId: string,
    action: string,
    title: string,
    description: string,
    metadata?: any,
  ): Promise<Activity | null> {
    const store = requestContextStorage.getStore();
    if (store?.source === 'AUTOMATION') {
      return null;
    }

    return this.prisma.activity.create({
      data: {
        organizationId,
        actorId,
        entityType,
        entityId,
        action,
        title,
        description,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  }

  async getActivities(
    organizationId: string,
    query: { page?: number; limit?: number; search?: string; type?: string } = {},
  ) {
    const { page = 1, limit = 10, search, type } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {
      organizationId,
    };

    if (type && type !== 'all') {
      where.entityType = type.toLowerCase();
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }

  async getActivitiesByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {
      organizationId,
      entityType,
      entityId,
    };

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  }
}
