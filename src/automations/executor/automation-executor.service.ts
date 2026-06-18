import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TemplateResolverService } from './template-resolver.service';
import { TasksService } from '../../tasks/tasks.service';
import { NotificationProducerService } from '../../queue/producers/notification-producer.service';
import { EmailProducerService } from '../../queue/producers/email-producer.service';
import { AutomationRule, AutomationActionType } from '@prisma/client';
import { ConditionEvaluatorService } from './condition-evaluator.service';

@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly templateResolver: TemplateResolverService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasksService: TasksService,
    private readonly notificationProducer: NotificationProducerService,
    private readonly emailProducer: EmailProducerService,
    private readonly conditionEvaluator: ConditionEvaluatorService,
  ) {}

  async executeRule(rule: AutomationRule, jobData: any) {
    const { organizationId, actorId, entityId, entityType, automationExecutionId, loopDepth } = jobData;

    // GATE 1: Loop Depth check
    if (loopDepth > 5) {
      this.logger.error(`[Execution Trace: ${automationExecutionId}] Loop depth limit exceeded (> 5). Rule: ${rule.id}`);
      throw new Error(`Automation execution blocked: Loop depth limit exceeded (> 5)`);
    }

    // GATE 2: Redis Rate-Limiter (Entity Scoped)
    const redisKey = `auto_limit:${organizationId}:${entityType}:${entityId}:${rule.id}`;
    const runCount = await this.redisService.incrAndExpire(redisKey, 60); // 60-second limit window
    if (runCount > 3) {
      this.logger.error(`[Execution Trace: ${automationExecutionId}] Execution rate limit exceeded for rule ${rule.id} on entity ${entityId} (> 3 runs in 60s)`);
      throw new Error(`Automation execution blocked: Rate limit exceeded (> 3 runs in 60s)`);
    }

    // 1. Fetch template resolution context
    const context = await this.templateResolver.resolveContext(entityType, entityId, actorId, organizationId);

    // 2. Evaluate conditions
    const conditionResult = this.conditionEvaluator.evaluate(rule.conditionsJson as any[], context);
    if (!conditionResult.passed) {
      this.logger.log(`[Execution Trace: ${automationExecutionId}] Rule "${rule.name}" conditions failed: ${conditionResult.reason}`);
      return { skipped: true, reason: conditionResult.reason };
    }

    // 3. Fetch actions
    const actions = await this.prisma.automationAction.findMany({
      where: { ruleId: rule.id },
    });

    this.logger.log(`[Execution Trace: ${automationExecutionId}] Executing ${actions.length} actions for rule ${rule.name}`);

    for (const action of actions) {
      const config = action.configurationJson as any;

      if (action.actionType === AutomationActionType.CREATE_TASK) {
        // Resolve dynamic variables
        const resolvedTitle = this.templateResolver.resolveTemplate(config.title || 'Automated Task', context);
        const resolvedDescription = this.templateResolver.resolveTemplate(config.description || '', context);

        // Resolve Assignee
        let resolvedAssigneeId = config.assigneeId;
        if (resolvedAssigneeId === 'ACTOR') {
          resolvedAssigneeId = actorId;
        } else if (resolvedAssigneeId === 'OWNER') {
          resolvedAssigneeId = context.deal?.ownerId || context.contact?.ownerId || actorId;
        }

        // Validate organization membership if assignee is specified
        if (resolvedAssigneeId) {
          const isMember = await this.prisma.organizationMember.findFirst({
            where: { userId: resolvedAssigneeId, organizationId },
          });
          if (!isMember) {
            throw new Error(`Assignee user ${resolvedAssigneeId} does not belong to organization ${organizationId}`);
          }
        }

        // Calculate Due Date
        let resolvedDueDate: string | undefined = undefined;
        if (config.dueDateOffsetDays) {
          const date = new Date();
          date.setDate(date.getDate() + Number(config.dueDateOffsetDays));
          resolvedDueDate = date.toISOString();
        }

        const taskDto = {
          title: resolvedTitle,
          description: resolvedDescription,
          status: 'TODO',
          priority: config.priority || 'MEDIUM',
          dueDate: resolvedDueDate,
          assigneeId: resolvedAssigneeId || actorId,
          dealId: entityType.toLowerCase() === 'deal' ? entityId : undefined,
        };

        this.logger.log(`[Execution Trace: ${automationExecutionId}] Rule ${rule.name} triggering CREATE_TASK for organization ${organizationId}`);
        await this.tasksService.create(taskDto, actorId || 'SYSTEM_AUTOMATION', organizationId);
      }

      else if (action.actionType === AutomationActionType.SEND_NOTIFICATION) {
        // Resolve templates
        const resolvedTitle = this.templateResolver.resolveTemplate(config.title || 'Notification', context);
        const resolvedMessage = this.templateResolver.resolveTemplate(config.message || '', context);

        // Resolve Target User
        let resolvedUserId = config.userId;
        if (resolvedUserId === 'ACTOR') {
          resolvedUserId = actorId;
        } else if (resolvedUserId === 'OWNER') {
          resolvedUserId = context.deal?.ownerId || context.contact?.ownerId || actorId;
        }

        // Validate organization membership if target user is specified
        if (resolvedUserId) {
          const isMember = await this.prisma.organizationMember.findFirst({
            where: { userId: resolvedUserId, organizationId },
          });
          if (!isMember) {
            throw new Error(`Notification recipient user ${resolvedUserId} does not belong to organization ${organizationId}`);
          }

          this.logger.log(`[Execution Trace: ${automationExecutionId}] Rule ${rule.name} triggering SEND_NOTIFICATION for user ${resolvedUserId}`);
          await this.notificationProducer.addJob('create-notification', {
            userId: resolvedUserId,
            organizationId,
            event: rule.triggerEvent,
            title: resolvedTitle,
            message: resolvedMessage,
            entityType,
            entityId,
          });
        }
      }

      else if (action.actionType === AutomationActionType.SEND_EMAIL) {
        // Resolve templates
        const resolvedSubject = this.templateResolver.resolveTemplate(config.subject || 'Automated Email', context);
        const resolvedBody = this.templateResolver.resolveTemplate(config.body || '', context);

        // Resolve Recipient
        let resolvedTo = config.to;
        if (resolvedTo === 'ACTOR') {
          resolvedTo = context.actor?.email;
        } else if (resolvedTo === 'OWNER') {
          const ownerId = context.deal?.ownerId || context.contact?.ownerId;
          if (ownerId) {
            const owner = await this.prisma.user.findUnique({
              where: { id: ownerId },
              select: { email: true },
            });
            resolvedTo = owner?.email;
          }
        } else if (resolvedTo === 'CONTACT') {
          resolvedTo = context.contact?.email;
        } else if (resolvedTo) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(resolvedTo)) {
            const member = await this.prisma.organizationMember.findFirst({
              where: { userId: resolvedTo, organizationId },
              include: { user: { select: { email: true } } },
            });
            if (!member || !member.user) {
              throw new Error(`Email recipient user ${resolvedTo} does not belong to organization ${organizationId}`);
            }
            resolvedTo = member.user.email;
          }
        }

        if (resolvedTo) {
          this.logger.log(`[Execution Trace: ${automationExecutionId}] Rule ${rule.name} triggering SEND_EMAIL to ${resolvedTo}`);
          await this.emailProducer.addJob('send-email-job', {
            to: resolvedTo,
            subject: resolvedSubject,
            body: resolvedBody,
            organizationId,
            automationExecutionId,
          });
        }
      }
    }
  }
}
