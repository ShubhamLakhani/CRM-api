import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailConsumer } from './email.consumer';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationExecutionStatus } from '@prisma/client';
import { Job } from 'bullmq';

describe('EmailConsumer', () => {
  let consumer: EmailConsumer;
  let mockEmailService: any;
  let mockPrismaService: any;
  let mockDeadLetterQueue: any;

  beforeEach(async () => {
    mockEmailService = {
      sendEmail: jest.fn(),
    };

    mockPrismaService = {
      automationExecution: {
        update: jest.fn(),
      },
    };

    mockDeadLetterQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailConsumer,
        { provide: EmailService, useValue: mockEmailService },
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: getQueueToken('dead-letter'),
          useValue: mockDeadLetterQueue,
        },
      ],
    }).compile();

    consumer = module.get<EmailConsumer>(EmailConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  it('should process job and invoke EmailService.sendEmail', async () => {
    const jobData = {
      to: 'client@test.com',
      subject: 'Welcome',
      body: '<h1>Hello</h1>',
      automationExecutionId: 'trace-123',
    };

    const mockJob = {
      id: 'job-1',
      name: 'send-email-job',
      data: jobData,
      attemptsMade: 1,
    } as unknown as Job<any, any, string>;

    mockEmailService.sendEmail.mockResolvedValue(undefined);

    await expect(consumer.process(mockJob)).resolves.not.toThrow();

    expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
      to: 'client@test.com',
      subject: 'Welcome',
      html: '<h1>Hello</h1>',
      automationExecutionId: 'trace-123',
    });
  });

  it('should propagate sendEmail failure to BullMQ', async () => {
    const jobData = {
      to: 'client@test.com',
      subject: 'Welcome',
      body: '<h1>Hello</h1>',
      automationExecutionId: 'trace-123',
    };

    const mockJob = {
      id: 'job-1',
      name: 'send-email-job',
      data: jobData,
      attemptsMade: 1,
    } as unknown as Job<any, any, string>;

    const error = new Error('SMTP Error');
    mockEmailService.sendEmail.mockRejectedValue(error);

    await expect(consumer.process(mockJob)).rejects.toThrow('SMTP Error');
  });

  it('should update automation execution status to FAILED when all retries are exhausted', async () => {
    const jobData = {
      to: 'client@test.com',
      subject: 'Welcome',
      body: '<h1>Hello</h1>',
      automationExecutionId: 'trace-123',
    };

    const mockJob = {
      id: 'job-1',
      name: 'send-email-job',
      data: jobData,
      attemptsMade: 3,
      opts: { attempts: 3 },
      failedReason: 'SMTP connection failed',
    } as unknown as Job<any, any, string>;

    const error = new Error('SMTP connection failed');
    mockPrismaService.automationExecution.update.mockResolvedValue({ id: 'exec-1' });

    await consumer.onFailed(mockJob, error);

    expect(mockPrismaService.automationExecution.update).toHaveBeenCalledWith({
      where: { automationExecutionId: 'trace-123' },
      data: {
        status: AutomationExecutionStatus.FAILED,
        errorMessage: 'Email delivery failed: SMTP connection failed',
        completedAt: expect.any(Date),
      },
    });

    expect(mockDeadLetterQueue.add).toHaveBeenCalledWith('dead-letter-job', expect.objectContaining({
      originalQueue: 'emails',
      jobId: 'job-1',
      failedReason: 'SMTP connection failed',
    }));
  });
});
