import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { ActivityEventListener } from './activity-event.listener';
import { PrismaService } from '../database/prisma.service';

describe('Activities Subsystem', () => {
  let service: ActivityService;
  let controller: ActivityController;
  let listener: ActivityEventListener;

  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      activity: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Shubham' }),
      },
      contact: {
        findUnique: jest.fn().mockResolvedValue({ name: 'John Doe' }),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Acme Inc' }),
      },
      deal: {
        findUnique: jest.fn().mockResolvedValue({ title: 'Website Redesign' }),
      },
      task: {
        findUnique: jest.fn().mockResolvedValue({ title: 'Follow-up Call' }),
      },
      auditLog: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        ActivityService,
        ActivityEventListener,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    controller = module.get<ActivityController>(ActivityController);
    listener = module.get<ActivityEventListener>(ActivityEventListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ActivityService', () => {
    it('should log activity record', async () => {
      mockPrismaService.activity.create.mockResolvedValue({ id: 'act-1' });

      const result = await service.logActivity(
        'org-123',
        'actor-123',
        'contact',
        'contact-123',
        'created',
        'Contact Created',
        'John Doe was created',
        { test: true },
      );

      expect(result).toEqual({ id: 'act-1' });
      expect(mockPrismaService.activity.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-123',
          actorId: 'actor-123',
          entityType: 'contact',
          entityId: 'contact-123',
          action: 'created',
          title: 'Contact Created',
          description: 'John Doe was created',
          metadata: { test: true },
        },
      });
    });

    it('should query paginated activities by organization', async () => {
      mockPrismaService.activity.findMany.mockResolvedValue([{ id: 'act-1' }]);
      mockPrismaService.activity.count.mockResolvedValue(1);

      const result = await service.getActivities('org-123', { page: 1, limit: 10 });
      expect(result.data).toEqual([{ id: 'act-1' }]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should query paginated activities by specific entity', async () => {
      mockPrismaService.activity.findMany.mockResolvedValue([{ id: 'act-2' }]);
      mockPrismaService.activity.count.mockResolvedValue(1);

      const result = await service.getActivitiesByEntity('org-123', 'deal', 'deal-123', { page: 1, limit: 5 });
      expect(result.data).toEqual([{ id: 'act-2' }]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('ActivityController', () => {
    it('findAll should query activity service', async () => {
      jest.spyOn(service, 'getActivities').mockResolvedValue({ data: [] } as any);

      await controller.findAll('org-123', 1, 10);
      expect(service.getActivities).toHaveBeenCalledWith('org-123', { page: 1, limit: 10 });
    });

    it('findByEntity should query activity service by entity params', async () => {
      jest.spyOn(service, 'getActivitiesByEntity').mockResolvedValue({ data: [] } as any);

      await controller.findByEntity('org-123', 'contact', 'contact-123', 2, 20);
      expect(service.getActivitiesByEntity).toHaveBeenCalledWith('org-123', 'contact', 'contact-123', { page: 2, limit: 20 });
    });
  });

  describe('ActivityEventListener & Domain Events integration', () => {
    it('CONTACT_CREATED should log corresponding activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onContactCreated({
        contactId: 'c1',
        organizationId: 'o1',
        userId: 'u1',
        name: 'John Doe',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'contact',
        'c1',
        'created',
        'John Doe was created',
        'Created by Shubham',
        { contactId: 'c1', name: 'John Doe' },
      );
    });

    it('CONTACT_UPDATED with status change should log corresponding status activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);
      mockPrismaService.auditLog.findFirst.mockResolvedValue({
        before: { status: 'LEAD' },
        after: { status: 'CUSTOMER' },
      });

      await listener.onContactUpdated({
        contactId: 'c1',
        organizationId: 'o1',
        userId: 'u1',
        changes: 'status',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'contact',
        'c1',
        'updated',
        'John Doe status changed',
        'Status changed from Lead to Customer',
        { contactId: 'c1', changes: 'status' },
      );
    });

    it('CONTACT_UPDATED with normal update should log generic updated activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);
      mockPrismaService.auditLog.findFirst.mockResolvedValue(null);

      await listener.onContactUpdated({
        contactId: 'c1',
        organizationId: 'o1',
        userId: 'u1',
        changes: 'phone',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'contact',
        'c1',
        'updated',
        'John Doe was updated',
        'Updated by Shubham',
        { contactId: 'c1', changes: 'phone' },
      );
    });

    it('COMPANY_CREATED should log corresponding activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onCompanyCreated({
        companyId: 'comp1',
        organizationId: 'o1',
        userId: 'u1',
        name: 'Acme Inc',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'company',
        'comp1',
        'created',
        'Acme Inc was created',
        'Created by Shubham',
        { companyId: 'comp1', name: 'Acme Inc' },
      );
    });

    it('COMPANY_UPDATED should log corresponding activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onCompanyUpdated({
        companyId: 'comp1',
        organizationId: 'o1',
        userId: 'u1',
        changes: 'domain',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'company',
        'comp1',
        'updated',
        'Acme Inc was updated',
        'Updated by Shubham',
        { companyId: 'comp1', changes: 'domain' },
      );
    });

    it('DEAL_CREATED should log corresponding activity with formatted Indian Rupees', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onDealCreated({
        dealId: 'd1',
        organizationId: 'o1',
        userId: 'u1',
        title: 'Website Redesign',
        value: 50000,
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'deal',
        'd1',
        'created',
        'Website Redesign was created',
        'Pipeline value ₹50,000',
        { dealId: 'd1', title: 'Website Redesign', value: 50000 },
      );
    });

    it('DEAL_STAGE_CHANGED should log corresponding stage title and description', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onDealStageChanged({
        dealId: 'd1',
        organizationId: 'o1',
        userId: 'u1',
        fromStage: 'PROPOSAL',
        toStage: 'NEGOTIATION',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'deal',
        'd1',
        'stage_changed',
        'Website Redesign moved to Negotiation',
        'Stage changed from Proposal to Negotiation',
        { dealId: 'd1', fromStage: 'PROPOSAL', toStage: 'NEGOTIATION' },
      );
    });

    it('DEAL_WON should log corresponding win activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onDealWon({
        dealId: 'd1',
        organizationId: 'o1',
        userId: 'u1',
        value: 50000,
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'deal',
        'd1',
        'won',
        'Website Redesign was marked as Won',
        'Deal value ₹50,000',
        { dealId: 'd1', value: 50000 },
      );
    });

    it('DEAL_LOST should log corresponding lost activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onDealLost({
        dealId: 'd1',
        organizationId: 'o1',
        userId: 'u1',
        value: 50000,
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'deal',
        'd1',
        'lost',
        'Website Redesign was marked as Lost',
        'Deal value ₹50,000',
        { dealId: 'd1', value: 50000 },
      );
    });

    it('DEAL_UPDATED should log corresponding updated activity with human-readable changes', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);
      mockPrismaService.auditLog.findFirst.mockResolvedValue({
        before: { title: 'Old Title', value: 30000 },
        after: { title: 'New Title', value: 45000 },
      });

      await listener.onDealUpdated({
        dealId: 'd1',
        organizationId: 'o1',
        userId: 'u1',
        changes: 'title, value',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'deal',
        'd1',
        'updated',
        'Website Redesign was updated',
        'Title updated\nValue changed from ₹30,000 to ₹45,000',
        { dealId: 'd1', changes: 'title, value' },
      );
    });

    it('CONTACT_UPDATED with multiple updates should convert to clean human-readable list', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);
      mockPrismaService.auditLog.findFirst.mockResolvedValue({
        before: { status: 'LEAD', email: 'old@email.com', ownerId: 'u-old' },
        after: { status: 'CONTACTED', email: 'new@email.com', ownerId: 'u-new' },
      });

      await listener.onContactUpdated({
        contactId: 'c1',
        organizationId: 'o1',
        userId: 'u1',
        changes: 'status, email, ownerId',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'contact',
        'c1',
        'updated',
        'John Doe status changed',
        'Status changed from Lead to Contacted\nEmail updated\nAssigned to Shubham',
        { contactId: 'c1', changes: 'status, email, ownerId' },
      );
    });

    it('TASK_CREATED should log corresponding activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onTaskCreated({
        taskId: 't1',
        organizationId: 'o1',
        userId: 'u1',
        title: 'Follow-up Call',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'task',
        't1',
        'created',
        'Follow-up Call was created',
        'Created by Shubham',
        { taskId: 't1', title: 'Follow-up Call' },
      );
    });

    it('TASK_COMPLETED should log corresponding activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onTaskCompleted({
        taskId: 't1',
        organizationId: 'o1',
        userId: 'u1',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'task',
        't1',
        'completed',
        'Follow-up Call completed',
        'Completed by Shubham',
        { taskId: 't1' },
      );
    });

    it('TASK_ASSIGNED should log corresponding assignment activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onTaskAssigned({
        taskId: 't1',
        assigneeId: 'u1',
        assignedById: 'u2',
        organizationId: 'o1',
        title: 'Follow-up Call',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u2',
        'task',
        't1',
        'updated',
        'Follow-up Call was assigned',
        'Assigned to Shubham by Shubham',
        { taskId: 't1', assigneeId: 'u1' },
      );
    });

    it('TASK_UPDATED should log corresponding updated activity with human-readable changes', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);
      mockPrismaService.auditLog.findFirst.mockResolvedValue({
        before: { priority: 'LOW', status: 'IN_PROGRESS' },
        after: { priority: 'HIGH', status: 'COMPLETED' },
      });

      await listener.onTaskUpdated({
        taskId: 't1',
        organizationId: 'o1',
        userId: 'u1',
        changes: 'priority, status',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'task',
        't1',
        'updated',
        'Follow-up Call was updated',
        'Priority changed from Low to High\nStatus changed from In Progress to Completed',
        { taskId: 't1', changes: 'priority, status' },
      );
    });

    it('USER_INVITED should log corresponding activity with markdown email link', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onUserInvited({
        inviteId: 'i1',
        organizationId: 'o1',
        invitedById: 'u1',
        email: 'simaot@yopmail.com',
        roleId: 'role1',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'user',
        'i1',
        'invited',
        'User invited',
        'Shubham invited [simaot@yopmail.com](mailto:simaot@yopmail.com)',
        { inviteId: 'i1', email: 'simaot@yopmail.com', roleId: 'role1' },
      );
    });

    it('INVITE_ACCEPTED should log corresponding join activity', async () => {
      jest.spyOn(service, 'logActivity').mockResolvedValue({} as any);

      await listener.onInviteAccepted({
        inviteId: 'i1',
        organizationId: 'o1',
        userId: 'u1',
        roleId: 'role1',
      });

      expect(service.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'user',
        'u1',
        'invite_accepted',
        'Invite accepted',
        'Shubham joined the organization',
        { inviteId: 'i1', roleId: 'role1' },
      );
    });
  });
});
