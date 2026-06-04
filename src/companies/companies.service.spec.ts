import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from './companies.service';
import { PrismaService } from '../database/prisma.service';
import { DomainEventEmitter } from '../events/domain-event-emitter';
import { DomainEventType } from '../events/domain-events';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let mockPrismaService: any;
  let mockDomainEventEmitter: any;

  beforeEach(async () => {
    mockPrismaService = {
      company: {
        create: jest.fn(),
        update: jest.fn(),
      },
      deal: {
        create: jest.fn(),
      },
    };

    mockDomainEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DomainEventEmitter,
          useValue: mockDomainEventEmitter,
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create company', () => {
    it('should create a company and emit COMPANY_CREATED but NOT emit DEAL_CREATED', async () => {
      const mockCompany = {
        id: 'comp-123',
        name: 'Acme Corp',
        domain: 'acme.com',
        industry: 'Tech',
        employees: 100,
        organizationId: 'org-123',
        createdById: 'user-123',
      };

      mockPrismaService.company.create.mockResolvedValue(mockCompany);
      mockPrismaService.deal.create.mockResolvedValue({
        id: 'deal-123',
        title: 'Acme Corp Initial Opportunity',
        value: 50000,
      });

      const result = await service.create(
        {
          name: 'Acme Corp',
          domain: 'acme.com',
          industry: 'Tech',
          employees: 100,
          dealValue: 50000,
        },
        'user-123',
        'org-123',
      );

      expect(result).toEqual(mockCompany);
      
      // Verify prisma operations
      expect(mockPrismaService.company.create).toHaveBeenCalled();
      expect(mockPrismaService.deal.create).toHaveBeenCalled();

      // Verify domain events
      // 1. Should emit COMPANY_CREATED
      expect(mockDomainEventEmitter.emit).toHaveBeenCalledWith(
        DomainEventType.COMPANY_CREATED,
        {
          companyId: 'comp-123',
          organizationId: 'org-123',
          userId: 'user-123',
          name: 'Acme Corp',
        },
      );

      // 2. Should NOT emit DEAL_CREATED
      const dealCreatedCalls = mockDomainEventEmitter.emit.mock.calls.filter(
        (call: any) => call[0] === DomainEventType.DEAL_CREATED,
      );
      expect(dealCreatedCalls).toHaveLength(0);
    });
  });
});
