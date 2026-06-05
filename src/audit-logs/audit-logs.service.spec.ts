import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '../database/prisma.service';

describe('AuditLogsService', () => {
  let service: AuditLogsService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      auditLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated audit logs for the current organization', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'CREATE',
          entityType: 'COMPANY',
          entityId: 'comp-1',
          before: null,
          after: { name: 'Acme' },
          ipAddress: '127.0.0.1',
          createdAt: new Date('2026-06-05T00:00:00Z'),
          userId: 'user-1',
          organizationId: 'org-123',
          user: { id: 'user-1', name: 'Sarah Connor', email: 'demo@apex.com' },
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10 },
        'org-123',
      );

      expect(result).toEqual({
        data: mockLogs,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      expect(mockPrismaService.auditLog.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
      });
    });

    it('should build where clause with search and filters', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);
      mockPrismaService.auditLog.count.mockResolvedValue(0);

      await service.findAll(
        {
          page: 2,
          limit: 5,
          search: 'Acme',
          entityType: 'Company',
          action: 'update',
          actorId: 'user-1',
          startDate: '2026-06-01T00:00:00.000Z',
          endDate: '2026-06-10T00:00:00.000Z',
        },
        'org-123',
      );

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-123',
          entityType: { equals: 'COMPANY' },
          action: { equals: 'UPDATE' },
          userId: 'user-1',
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-10T00:00:00.000Z'),
          },
          OR: [
            { action: { contains: 'Acme', mode: 'insensitive' } },
            { entityType: { contains: 'Acme', mode: 'insensitive' } },
            { entityId: { contains: 'Acme', mode: 'insensitive' } },
            { ipAddress: { contains: 'Acme', mode: 'insensitive' } },
            { user: { name: { contains: 'Acme', mode: 'insensitive' } } },
            { user: { email: { contains: 'Acme', mode: 'insensitive' } } },
          ],
        },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single audit log when found', async () => {
      const mockLog = {
        id: 'log-1',
        action: 'CREATE',
        entityType: 'COMPANY',
        organizationId: 'org-123',
      };
      mockPrismaService.auditLog.findFirst.mockResolvedValue(mockLog);

      const result = await service.findOne('log-1', 'org-123');

      expect(result).toEqual(mockLog);
      expect(mockPrismaService.auditLog.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'log-1',
          organizationId: 'org-123',
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    it('should throw NotFoundException when audit log is not found', async () => {
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);

      await expect(service.findOne('log-999', 'org-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exportCsv', () => {
    it('should generate properly formatted CSV string', async () => {
      const mockLogs = [
        {
          createdAt: new Date('2026-06-05T01:00:00.000Z'),
          entityType: 'COMPANY',
          action: 'CREATE',
          before: null,
          after: { name: 'Acme, Inc.', isCool: true },
          ipAddress: '127.0.0.1',
          user: { name: 'John Doe', email: 'john@doe.com' },
        },
        {
          createdAt: new Date('2026-06-05T02:00:00.000Z'),
          entityType: 'DEAL',
          action: 'DELETE',
          before: { title: 'Big Deal "Quote"' },
          after: null,
          ipAddress: null,
          user: null, // System actor
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.exportCsv({}, 'org-123');

      // Assert headers are present
      expect(result).toContain('timestamp,actor,entityType,action,before,after,ipAddress');
      
      // First line check (John Doe actor, JSON state with nested comma in company name)
      expect(result).toContain('2026-06-05T01:00:00.000Z');
      expect(result).toContain('John Doe (john@doe.com)');
      expect(result).toContain('CREATE');
      expect(result).toContain('"{""name"":""Acme, Inc."",""isCool"":true}"'); // comma & quotes require double-quoting
      
      // Second line check (System actor, quotes inside JSON title)
      expect(result).toContain('2026-06-05T02:00:00.000Z');
      expect(result).toContain('System');
      expect(result).toContain('DELETE');
      expect(result).toContain('Big Deal \\""Quote\\""');
    });
  });
});
