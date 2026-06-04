import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEventListener } from './notification-event.listener';
import { NotificationConsumer } from '../queue/consumers/notification.consumer';
import { NotificationProducerService } from '../queue/producers/notification-producer.service';
import { PrismaService } from '../database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';

describe('Notifications Engine', () => {
  let service: NotificationService;
  let controller: NotificationController;
  let listener: NotificationEventListener;
  let consumer: NotificationConsumer;

  let mockPrismaService: any;
  let mockProducerService: any;
  let mockDeadLetterQueue: any;

  beforeEach(async () => {
    mockPrismaService = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      deal: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockProducerService = {
      addJob: jest.fn(),
    };

    mockDeadLetterQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        NotificationEventListener,
        NotificationConsumer,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationProducerService,
          useValue: mockProducerService,
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    controller = module.get<NotificationController>(NotificationController);
    listener = module.get<NotificationEventListener>(NotificationEventListener);
    consumer = module.get<NotificationConsumer>(NotificationConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('NotificationService', () => {
    it('should create notification', async () => {
      mockPrismaService.notification.create.mockResolvedValue({ id: '1' });
      const result = await service.createNotification('u1', 'o1', 'TEST', 'Title', 'Msg');
      expect(result).toEqual({ id: '1' });
      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          organizationId: 'o1',
          type: 'IN_APP',
          event: 'TEST',
          title: 'Title',
          message: 'Msg',
        },
      });
    });

    it('should query paginated notifications', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([{ id: '1' }]);
      mockPrismaService.notification.count.mockResolvedValue(1);

      const result = await service.getUserNotifications('u1', 'o1', { page: 1, limit: 10 });
      expect(result.data).toEqual([{ id: '1' }]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should query unread notifications count', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);
      const count = await service.getUnreadCount('u1', 'o1');
      expect(count).toBe(5);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId: 'u1', organizationId: 'o1', readAt: null },
      });
    });

    it('should mark single notification as read', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue({ id: 'n1' });
      mockPrismaService.notification.update.mockResolvedValue({ id: 'n1', readAt: new Date() });

      await service.markAsRead('n1', 'u1', 'o1');

      expect(mockPrismaService.notification.findFirst).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1', organizationId: 'o1' },
      });
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'n1' },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should mark all notifications as read', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('u1', 'o1');
      expect(result).toEqual({ count: 3 });
      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', organizationId: 'o1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('NotificationController', () => {
    it('findAll should call service', async () => {
      jest.spyOn(service, 'getUserNotifications').mockResolvedValue({ data: [] } as any);
      await controller.findAll('u1', 'o1', 'true', 1, 10);
      expect(service.getUserNotifications).toHaveBeenCalledWith('u1', 'o1', {
        unreadOnly: true,
        page: 1,
        limit: 10,
      });
    });

    it('getUnreadCount should call service', async () => {
      jest.spyOn(service, 'getUnreadCount').mockResolvedValue(10);
      await controller.getUnreadCount('u1', 'o1');
      expect(service.getUnreadCount).toHaveBeenCalledWith('u1', 'o1');
    });

    it('markAsRead should call service', async () => {
      jest.spyOn(service, 'markAsRead').mockResolvedValue({ id: 'n1' } as any);
      await controller.markAsRead('n1', 'u1', 'o1');
      expect(service.markAsRead).toHaveBeenCalledWith('n1', 'u1', 'o1');
    });

    it('markAllAsRead should call service', async () => {
      jest.spyOn(service, 'markAllAsRead').mockResolvedValue({ count: 5 });
      await controller.markAllAsRead('u1', 'o1');
      expect(service.markAllAsRead).toHaveBeenCalledWith('u1', 'o1');
    });
  });

  describe('NotificationEventListener & Domain Events integration', () => {
    it('TASK_ASSIGNED should enqueue creation job', async () => {
      await listener.onTaskAssigned({
        taskId: 't1',
        assigneeId: 'u1',
        assignedById: 'u2',
        organizationId: 'o1',
        title: 'Complete task',
      });

      expect(mockProducerService.addJob).toHaveBeenCalledWith('create-notification', {
        userId: 'u1',
        organizationId: 'o1',
        event: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: 'You have been assigned to task: "Complete task".',
      });
    });

    it('TASK_DUE should enqueue creation job', async () => {
      await listener.onTaskDue({
        taskId: 't1',
        userId: 'u1',
        organizationId: 'o1',
        dueDate: new Date(),
        title: 'Due task',
      });

      expect(mockProducerService.addJob).toHaveBeenCalledWith('create-notification', {
        userId: 'u1',
        organizationId: 'o1',
        event: 'TASK_DUE',
        title: 'Task Due Soon',
        message: 'Your task "Due task" is due soon.',
      });
    });

    it('DEAL_WON should enqueue creation job', async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue({ title: 'Big Sale' });

      await listener.onDealWon({
        dealId: 'd1',
        userId: 'u1',
        organizationId: 'o1',
        value: 5000,
      });

      expect(mockPrismaService.deal.findUnique).toHaveBeenCalledWith({ where: { id: 'd1' } });
      expect(mockProducerService.addJob).toHaveBeenCalledWith('create-notification', {
        userId: 'u1',
        organizationId: 'o1',
        event: 'DEAL_WON',
        title: 'Deal Won!',
        message: 'Congratulations! The deal "Big Sale" has been marked as WON for $5000.',
      });
    });

    it('USER_INVITED should notify existing user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u_invited' });

      await listener.onUserInvited({
        inviteId: 'i1',
        organizationId: 'o1',
        invitedById: 'u_inviter',
        email: 'invited@user.com',
        roleId: 'role1',
      });

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({ where: { email: 'invited@user.com' } });
      expect(mockProducerService.addJob).toHaveBeenCalledWith('create-notification', {
        userId: 'u_invited',
        organizationId: 'o1',
        event: 'USER_INVITED',
        title: 'Workspace Invitation',
        message: 'You have been invited to join another organization.',
      });
    });

    it('USER_INVITED should notify inviter if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await listener.onUserInvited({
        inviteId: 'i1',
        organizationId: 'o1',
        invitedById: 'u_inviter',
        email: 'new@user.com',
        roleId: 'role1',
      });

      expect(mockProducerService.addJob).toHaveBeenCalledWith('create-notification', {
        userId: 'u_inviter',
        organizationId: 'o1',
        event: 'USER_INVITED',
        title: 'Invitation Sent',
        message: 'Invitation successfully sent to new@user.com.',
      });
    });
  });

  describe('NotificationConsumer', () => {
    it('should process job by creating notification', async () => {
      const mockJob = {
        id: 'job-123',
        attemptsMade: 0,
        data: {
          userId: 'u1',
          organizationId: 'o1',
          event: 'TASK_ASSIGNED',
          title: 'Title',
          message: 'Msg',
        },
      } as unknown as Job;

      const createSpy = jest.spyOn(service, 'createNotification').mockResolvedValue({} as any);

      await consumer.process(mockJob);

      expect(createSpy).toHaveBeenCalledWith('u1', 'o1', 'TASK_ASSIGNED', 'Title', 'Msg');
    });
  });
});
