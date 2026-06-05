import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  private buildWhereClause(query: Omit<AuditLogsQueryDto, 'page' | 'limit'>, organizationId: string) {
    const { search, entityType, action, actorId, startDate, endDate } = query;
    const where: any = {
      organizationId,
    };

    if (entityType) {
      where.entityType = {
        equals: entityType.toUpperCase(),
      };
    }

    if (action) {
      where.action = {
        equals: action.toUpperCase(),
      };
    }

    if (actorId) {
      where.userId = actorId;
    }

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Search filter matching action, entityType, entityId, ipAddress, or user name/email
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        {
          user: {
            name: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    return where;
  }

  async findAll(queryDto: AuditLogsQueryDto, organizationId: string) {
    const { page = 1, limit = 10 } = queryDto;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(queryDto, organizationId);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID ${id} not found in this organization`);
    }

    return auditLog;
  }

  async exportCsv(query: Omit<AuditLogsQueryDto, 'page' | 'limit'>, organizationId: string): Promise<string> {
    const where = this.buildWhereClause(query, organizationId);

    // Fetch all matching logs
    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Helper to escape CSV values correctly
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) {
        return '';
      }
      let str = '';
      if (typeof val === 'object') {
        str = JSON.stringify(val);
      } else {
        str = String(val);
      }
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Construct CSV Header
    const headers = ['timestamp', 'actor', 'entityType', 'action', 'before', 'after', 'ipAddress'];
    const rows = logs.map((log) => {
      const actorName = log.user
        ? log.user.name
          ? `${log.user.name} (${log.user.email})`
          : log.user.email
        : 'System';

      return [
        log.createdAt.toISOString(),
        actorName,
        log.entityType,
        log.action,
        log.before,
        log.after,
        log.ipAddress || '',
      ].map(escapeCsv);
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    return csvContent;
  }
}
