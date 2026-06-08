import { Test, TestingModule } from '@nestjs/testing';
import { AutomationsService } from './automations.service';
import { AutomationsController } from './automations.controller';
import { AutomationEventListener } from './automation-event.listener';
import { AutomationExecutorService } from './executor/automation-executor.service';
import { TemplateResolverService } from './executor/template-resolver.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationProducerService } from '../queue/producers/notification-producer.service';
import { EmailProducerService } from '../queue/producers/email-producer.service';
import { AutomationProducerService } from '../queue/producers/automation-producer.service';
import { AutomationTrigger, AutomationActionType } from '@prisma/client';
import { ActivityService } from '../activities/activity.service';
import { ConditionEvaluatorService } from './executor/condition-evaluator.service';

describe('Automations Subsystem', () => {
  let automationsService: AutomationsService;
  let executorService: AutomationExecutorService;
  let resolverService: TemplateResolverService;

  let mockPrismaService: any;
  let mockRedisService: any;
  let mockTasksService: any;
  let mockNotificationProducer: any;
  let mockEmailProducer: any;
  let mockAutomationProducer: any;
  let mockActivityService: any;

  beforeEach(async () => {
    mockPrismaService = {
      automationRule: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      automationAction: {
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
      automationExecution: {
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', name: 'Sarah Connor', email: 'sarah@apex.com' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'u1', name: 'Sarah Connor', email: 'sarah@apex.com' }),
      },
      contact: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'John Doe', email: 'john@doe.com', organizationId: 'o1' }),
      },
      deal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'd1', title: 'Solar Deal', ownerId: 'u1', organizationId: 'o1' }),
      },
      task: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrismaService)),
    };

    mockRedisService = {
      incrAndExpire: jest.fn().mockResolvedValue(1),
    };

    mockTasksService = {
      create: jest.fn().mockResolvedValue({ id: 't1' }),
    };

    mockNotificationProducer = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-notify-1' }),
    };

    mockEmailProducer = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-email-1' }),
    };

    mockAutomationProducer = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-auto-1' }),
    };

    mockActivityService = {
      logActivity: jest.fn().mockResolvedValue({ id: 'act-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutomationsController],
      providers: [
        AutomationsService,
        AutomationEventListener,
        AutomationExecutorService,
        TemplateResolverService,
        ConditionEvaluatorService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: TasksService, useValue: mockTasksService },
        { provide: NotificationProducerService, useValue: mockNotificationProducer },
        { provide: EmailProducerService, useValue: mockEmailProducer },
        { provide: AutomationProducerService, useValue: mockAutomationProducer },
        { provide: ActivityService, useValue: mockActivityService },
      ],
    }).compile();

    automationsService = module.get<AutomationsService>(AutomationsService);
    executorService = module.get<AutomationExecutorService>(AutomationExecutorService);
    resolverService = module.get<TemplateResolverService>(TemplateResolverService);
  });

  describe('AutomationsService', () => {
    it('create should save rule and trigger logActivity', async () => {
      mockPrismaService.automationRule.create.mockResolvedValue({ id: 'rule-1', name: 'Assign Task' });

      const result = await automationsService.create(
        {
          name: 'Assign Task',
          triggerEvent: AutomationTrigger.CONTACT_CREATED,
          actions: [
            {
              actionType: AutomationActionType.CREATE_TASK,
              configurationJson: { title: 'Call contact' },
            },
          ],
        },
        'u1',
        'o1',
      );

      expect(result).toEqual({ id: 'rule-1', name: 'Assign Task' });
      expect(mockPrismaService.automationRule.create).toHaveBeenCalled();
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'automation_rule',
        'rule-1',
        'created',
        'Automation rule created',
        'Rule "Assign Task" was created by Sarah Connor',
        { ruleId: 'rule-1' },
      );
    });

    it('update should replace actions, increment version, and log update', async () => {
      mockPrismaService.automationRule.findFirst.mockResolvedValue({ id: 'rule-1', name: 'Old Name' });
      mockPrismaService.automationRule.update.mockResolvedValue({ id: 'rule-1', name: 'New Name' });

      await automationsService.update(
        'rule-1',
        {
          name: 'New Name',
        },
        'u1',
        'o1',
      );

      expect(mockPrismaService.automationRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: {
          name: 'New Name',
          version: { increment: 1 },
        },
        include: {
          actions: true,
        },
      });
      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        'o1',
        'u1',
        'automation_rule',
        'rule-1',
        'updated',
        'Automation rule updated',
        'Rule "New Name" was updated by Sarah Connor',
        { ruleId: 'rule-1' },
      );
    });
  });

  describe('TemplateResolverService', () => {
    it('resolveTemplate should resolve properties using dot notation', () => {
      const template = 'Hello {{contact.name}}, your deal {{deal.title}} is worth {{deal.value}}!';
      const context = {
        contact: { name: 'Elon Musk' },
        deal: { title: 'Tesla Integration', value: 120000 },
      };

      const result = resolverService.resolveTemplate(template, context);
      expect(result).toBe('Hello Elon Musk, your deal Tesla Integration is worth 120000!');
    });

    it('resolveTemplate should return empty string if variable is missing', () => {
      const template = 'Contact: {{contact.missingProperty}}';
      const context = { contact: { name: 'Satya' } };

      const result = resolverService.resolveTemplate(template, context);
      expect(result).toBe('Contact: ');
    });
  });

  describe('AutomationExecutorService Gate Checkers', () => {
    it('executeRule should throw error if loop depth > 5', async () => {
      const rule = { id: 'r1', name: 'Rule' } as any;
      const jobData = { loopDepth: 6 };

      await expect(executorService.executeRule(rule, jobData)).rejects.toThrow(
        'Automation execution blocked: Loop depth limit exceeded (> 5)',
      );
    });

    it('executeRule should throw error if Redis count exceeds rate limit', async () => {
      const rule = { id: 'r1', name: 'Rule' } as any;
      const jobData = {
        loopDepth: 2,
        organizationId: 'o1',
        entityType: 'deal',
        entityId: 'd1',
      };
      mockRedisService.incrAndExpire.mockResolvedValue(4); // exceeds rate limit (> 3)

      await expect(executorService.executeRule(rule, jobData)).rejects.toThrow(
        'Automation execution blocked: Rate limit exceeded (> 3 runs in 60s)',
      );
    });

    it('executeRule should trigger CREATE_TASK successfully', async () => {
      const rule = { id: 'r1', name: 'Assign Task', triggerEvent: AutomationTrigger.CONTACT_CREATED } as any;
      const jobData = {
        loopDepth: 1,
        organizationId: 'o1',
        entityType: 'contact',
        entityId: 'c1',
        actorId: 'u1',
        automationExecutionId: 'exec-1',
      };

      mockPrismaService.automationAction.findMany.mockResolvedValue([
        {
          id: 'action-1',
          actionType: AutomationActionType.CREATE_TASK,
          configurationJson: { title: 'Follow-up with {{contact.name}}', priority: 'HIGH', dueDateOffsetDays: 3 },
        },
      ]);

      await executorService.executeRule(rule, jobData);

      expect(mockTasksService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Follow-up with John Doe',
          priority: 'HIGH',
        }),
        'u1',
        'o1',
      );
    });
  });
});
