import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { NotificationProducerService } from './producers/notification-producer.service';
import { EmailProducerService } from './producers/email-producer.service';
import { AutomationProducerService } from './producers/automation-producer.service';
import { NotificationConsumer } from './consumers/notification.consumer';
import { DeadLetterConsumer } from './consumers/dead-letter.consumer';
import { NotificationService } from '../notifications/notification.service';
import { QueueController } from './queue.controller';

describe('Queue Infrastructure', () => {
  let notificationProducer: NotificationProducerService;
  let emailProducer: EmailProducerService;
  let automationProducer: AutomationProducerService;
  let notificationConsumer: NotificationConsumer;
  let deadLetterConsumer: DeadLetterConsumer;
  let queueController: QueueController;

  let mockNotificationsQueue: any;
  let mockEmailsQueue: any;
  let mockAutomationsQueue: any;
  let mockDeadLetterQueue: any;

  beforeEach(async () => {
    mockNotificationsQueue = { add: jest.fn() };
    mockEmailsQueue = { add: jest.fn() };
    mockAutomationsQueue = { add: jest.fn() };
    mockDeadLetterQueue = {
      add: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProducerService,
        EmailProducerService,
        AutomationProducerService,
        NotificationConsumer,
        DeadLetterConsumer,
        QueueController,
        {
          provide: NotificationService,
          useValue: { createNotification: jest.fn() },
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockNotificationsQueue,
        },
        {
          provide: getQueueToken('emails'),
          useValue: mockEmailsQueue,
        },
        {
          provide: getQueueToken('automations'),
          useValue: mockAutomationsQueue,
        },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    notificationProducer = module.get<NotificationProducerService>(NotificationProducerService);
    emailProducer = module.get<EmailProducerService>(EmailProducerService);
    automationProducer = module.get<AutomationProducerService>(AutomationProducerService);
    notificationConsumer = module.get<NotificationConsumer>(NotificationConsumer);
    deadLetterConsumer = module.get<DeadLetterConsumer>(DeadLetterConsumer);
    queueController = module.get<QueueController>(QueueController);
  });

  describe('producers', () => {
    it('should add notification job with default retry options', async () => {
      mockNotificationsQueue.add.mockResolvedValue({ id: 'job-1' });
      await notificationProducer.addJob('send-sms', { userId: '1' });
      expect(mockNotificationsQueue.add).toHaveBeenCalledWith(
        'send-sms',
        { userId: '1' },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
    });

    it('should override default retry options if custom opts are passed', async () => {
      await emailProducer.addJob('send-welcome', { email: 'test@test.com' }, { attempts: 5 });
      expect(mockEmailsQueue.add).toHaveBeenCalledWith(
        'send-welcome',
        { email: 'test@test.com' },
        {
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );
    });
  });

  describe('consumers & dead-letter queue routing', () => {
    it('should process jobs', async () => {
      const mockJob = { id: 'job-1', attemptsMade: 0, data: {} } as Job;
      await expect(notificationConsumer.process(mockJob)).resolves.toBeUndefined();
    });

    it('should forward job to dead-letter queue when attempts are exhausted', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'test-job',
        attemptsMade: 3,
        data: { payload: 'xyz' },
        failedReason: 'Timeout error',
        opts: { attempts: 3 },
      } as unknown as Job;

      await notificationConsumer.onFailed(mockJob, new Error('Timeout error'));

      expect(mockDeadLetterQueue.add).toHaveBeenCalledWith(
        'dead-letter-job',
        expect.objectContaining({
          originalQueue: 'notifications',
          jobId: 'job-1',
          name: 'test-job',
          data: { payload: 'xyz' },
          failedReason: 'Timeout error',
        }),
      );
    });

    it('should not forward job to dead-letter queue if attempts are not exhausted', async () => {
      const mockJob = {
        id: 'job-1',
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as unknown as Job;

      await notificationConsumer.onFailed(mockJob, new Error('Minor error'));

      expect(mockDeadLetterQueue.add).not.toHaveBeenCalled();
    });

    it('should process dead-letter jobs and log them', async () => {
      const mockDeadLetterJob = {
        data: {
          originalQueue: 'emails',
          jobId: 'job-9',
          name: 'send-welcome',
          data: { email: 'err@err.com' },
          failedReason: 'SMTP Connection failed',
          timestamp: '2026-06-04T12:00:00Z',
        },
      } as Job;

      await expect(deadLetterConsumer.process(mockDeadLetterJob)).resolves.toBeUndefined();
    });
  });

  describe('QueueController', () => {
    it('should return dead-letter jobs formatted', async () => {
      mockDeadLetterQueue.getJobs.mockResolvedValueOnce([
        {
          id: 'dlq-1',
          name: 'dead-letter-job',
          attemptsMade: 3,
          data: {
            originalQueue: 'notifications',
            jobId: 'job-1',
            name: 'create-notification',
            failedReason: 'Redis timeout',
            timestamp: '2026-06-04T13:00:00Z',
            data: { userId: '1' },
          },
        },
      ]);
      mockDeadLetterQueue.getJobs.mockResolvedValueOnce([]);

      const result = await queueController.getDeadLetterJobs();

      expect(mockDeadLetterQueue.getJobs).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(1);
      expect(result.jobs[0]).toEqual({
        id: 'dlq-1',
        name: 'dead-letter-job',
        originalQueue: 'notifications',
        originalJobId: 'job-1',
        failedReason: 'Redis timeout',
        failedAt: '2026-06-04T13:00:00Z',
        data: { userId: '1' },
        attemptsMade: 3,
      });
    });
  });
});
