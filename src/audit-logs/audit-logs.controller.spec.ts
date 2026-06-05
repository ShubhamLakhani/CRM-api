import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { PrismaService } from '../database/prisma.service';

describe('AuditLogsController', () => {
  let controller: AuditLogsController;
  let mockService: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      exportCsv: jest.fn(),
    };

    mockPrismaService = {}; // PermissionsGuard searches database for active user roles

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [
        {
          provide: AuditLogsService,
          useValue: mockService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<AuditLogsController>(AuditLogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return service results for findAll', async () => {
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      mockService.findAll.mockResolvedValue(mockResult);

      const queryDto = new AuditLogsQueryDto();
      const result = await controller.findAll(queryDto, 'org-123');

      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith(queryDto, 'org-123');
    });
  });

  describe('findOne', () => {
    it('should return service results for findOne', async () => {
      const mockLog = { id: 'log-1', action: 'CREATE', entityType: 'DEAL' };
      mockService.findOne.mockResolvedValue(mockLog);

      const result = await controller.findOne('log-1', 'org-123');

      expect(result).toEqual(mockLog);
      expect(mockService.findOne).toHaveBeenCalledWith('log-1', 'org-123');
    });
  });

  describe('export', () => {
    it('should write CSV response with appropriate headers', async () => {
      const mockCsvContent = 'timestamp,actor,entityType,action,before,after,ipAddress\n';
      mockService.exportCsv.mockResolvedValue(mockCsvContent);

      const queryDto: AuditLogsQueryDto = {
        page: 1,
        limit: 10,
        search: 'tesla',
        entityType: 'COMPANY',
      };

      const mockResponse = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response;

      await controller.export(queryDto, 'org-123', mockResponse);

      // Verify page and limit are stripped out in the call
      expect(mockService.exportCsv).toHaveBeenCalledWith(
        { search: 'tesla', entityType: 'COMPANY' },
        'org-123',
      );

      // Verify response headers are set
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="audit-logs.csv"',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(mockCsvContent);
    });
  });
});
