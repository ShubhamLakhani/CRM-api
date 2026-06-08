import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PlanEntitlementService } from './entitlement.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('Subscription & Entitlement (Unit)', () => {
  let subscriptionService: SubscriptionService;
  let entitlementService: PlanEntitlementService;

  const mockPlans = [
    {
      id: 'FREE',
      name: 'Free Plan',
      description: 'Free tier',
      price: 0,
      maxUsers: 1,
      maxContacts: 10,
      maxDeals: 3,
      aiAssistant: false,
      emailSync: false,
      automation: false,
      clientPortal: false,
    },
    {
      id: 'STARTER',
      name: 'Starter Plan',
      description: 'Starter tier',
      price: 19,
      maxUsers: 3,
      maxContacts: 100,
      maxDeals: 20,
      aiAssistant: true,
      emailSync: false,
      automation: false,
      clientPortal: false,
    },
  ];

  const mockSubscription = {
    id: 'sub-uuid-1',
    organizationId: 'org-uuid-1',
    planId: 'FREE',
    status: 'ACTIVE',
    startDate: new Date(),
    endDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: mockPlans[0],
  };

  const mockPrismaService = {
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    subscriptionPlan: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    organizationMember: {
      count: jest.fn(),
    },
    contact: {
      count: jest.fn(),
    },
    deal: {
      count: jest.fn(),
    },
    usageMetric: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        PlanEntitlementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    subscriptionService = module.get<SubscriptionService>(SubscriptionService);
    entitlementService = module.get<PlanEntitlementService>(PlanEntitlementService);
  });

  describe('SubscriptionService', () => {
    it('should retrieve the current subscription if it exists', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.getCurrentSubscription('org-uuid-1');
      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { organizationId: 'org-uuid-1' },
        include: { plan: true },
      });
    });

    it('should fallback to creating FREE subscription if it does not exist', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);
      mockPrismaService.subscription.create.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.getCurrentSubscription('org-uuid-1');
      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.subscription.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-uuid-1',
          planId: 'FREE',
          status: 'ACTIVE',
        },
        include: { plan: true },
      });
    });

    it('should calculate and cache usage correctly', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.organizationMember.count.mockResolvedValue(1);
      mockPrismaService.contact.count.mockResolvedValue(5);
      mockPrismaService.deal.count.mockResolvedValue(2);
      mockPrismaService.usageMetric.upsert.mockResolvedValue({});

      const usage = await subscriptionService.getUsage('org-uuid-1');

      expect(usage).toEqual({
        users: { usage: 1, limit: 1, remaining: 0 },
        contacts: { usage: 5, limit: 10, remaining: 5 },
        deals: { usage: 2, limit: 3, remaining: 1 },
        features: {
          AI_ASSISTANT: false,
          EMAIL_SYNC: false,
          AUTOMATION: false,
          CLIENT_PORTAL: false,
        },
      });

      expect(mockPrismaService.usageMetric.upsert).toHaveBeenCalledTimes(3);
    });

    it('should change plan if limits are not exceeded', async () => {
      const updatedSubscription = {
        ...mockSubscription,
        planId: 'STARTER',
        plan: mockPlans[1],
      };

      mockPrismaService.subscriptionPlan.findUnique.mockResolvedValue(mockPlans[1]);
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.organizationMember.count.mockResolvedValue(1);
      mockPrismaService.contact.count.mockResolvedValue(5);
      mockPrismaService.deal.count.mockResolvedValue(2);
      mockPrismaService.subscription.update.mockResolvedValue(updatedSubscription);

      const result = await subscriptionService.changePlan('org-uuid-1', 'STARTER');
      expect(result.planId).toBe('STARTER');
      expect(mockPrismaService.subscription.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if upgrading/downgrading exceeds target limits', async () => {
      mockPrismaService.subscriptionPlan.findUnique.mockResolvedValue(mockPlans[0]);
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrismaService.organizationMember.count.mockResolvedValue(2);
      mockPrismaService.contact.count.mockResolvedValue(5);
      mockPrismaService.deal.count.mockResolvedValue(2);

      await expect(
        subscriptionService.changePlan('org-uuid-1', 'FREE'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('PlanEntitlementService', () => {
    beforeEach(() => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSubscription);
    });

    it('should evaluate user creation permissions', async () => {
      mockPrismaService.organizationMember.count.mockResolvedValue(1);
      mockPrismaService.contact.count.mockResolvedValue(0);
      mockPrismaService.deal.count.mockResolvedValue(0);

      const canInvite = await entitlementService.canInviteUser('org-uuid-1');
      expect(canInvite).toBe(false);

      mockPrismaService.organizationMember.count.mockResolvedValue(0);
      const canInvite2 = await entitlementService.canInviteUser('org-uuid-1');
      expect(canInvite2).toBe(true);
    });

    it('should evaluate feature entitlements', async () => {
      expect(await entitlementService.canUseFeature('org-uuid-1', 'AI_ASSISTANT')).toBe(false);

      const starterSubscription = {
        ...mockSubscription,
        planId: 'STARTER',
        plan: mockPlans[1],
      };
      mockPrismaService.subscription.findUnique.mockResolvedValue(starterSubscription);
      expect(await entitlementService.canUseFeature('org-uuid-1', 'AI_ASSISTANT')).toBe(true);
      expect(await entitlementService.canUseFeature('org-uuid-1', 'EMAIL_SYNC')).toBe(false);
    });
  });
});
