import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AutomationProducerService } from '../producers/automation-producer.service';
import { AutomationExecutorService } from '../../automations/executor/automation-executor.service';
import { requestContextStorage } from '../../common/request-context';
import { AutomationExecutionStatus } from '@prisma/client';

@Processor('automations')
export class AutomationConsumer extends WorkerHost {
  private readonly logger = new Logger(AutomationConsumer.name);

  constructor(
    @InjectQueue('dead-letter') private readonly deadLetterQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly automationProducer: AutomationProducerService,
    @Inject(forwardRef(() => AutomationExecutorService))
    private readonly executor: AutomationExecutorService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { name, data } = job;
    this.logger.log(`[Queue Processing] Processing job "${name}" (ID: ${job.id}) in queue "automations" on attempt ${job.attemptsMade} with data: ${JSON.stringify(data)}`);

    if (name === 'process-trigger') {
      const { triggerEvent, organizationId, actorId, entityId, entityType, payload, automationExecutionId } = data;

      // Find all active automation rules for this trigger and tenant
      const activeRules = await this.prisma.automationRule.findMany({
        where: {
          organizationId,
          triggerEvent,
          isEnabled: true,
        },
      });

      this.logger.log(`[Execution Trace: ${automationExecutionId}] Found ${activeRules.length} enabled automation rules for ${triggerEvent} in organization ${organizationId}`);

      for (const rule of activeRules) {
        await this.automationProducer.addJob('execute-rule', {
          ruleId: rule.id,
          organizationId,
          actorId,
          entityId,
          entityType,
          payload,
          automationExecutionId: `${automationExecutionId}_${rule.id}`,
          loopDepth: 1, // Start loop tracking at depth 1
        });
      }
      return { triggeredCount: activeRules.length };
    }

    if (name === 'execute-rule') {
      const { ruleId, organizationId, actorId, entityId, entityType, payload, automationExecutionId, loopDepth } = data;

      // Wrap executing actions inside the context storage to ensure proper request source propagation
      return requestContextStorage.run(
        {
          userId: actorId || 'SYSTEM_AUTOMATION',
          organizationId,
          ipAddress: 'Automation Engine',
          source: 'AUTOMATION',
        },
        async () => {
          // Load rule scoped to tenant first
          const rule = await this.prisma.automationRule.findFirst({
            where: { id: ruleId, organizationId },
          });

          if (!rule) {
            this.logger.error(`[Execution Trace: ${automationExecutionId}] Rule ${ruleId} not found in organization ${organizationId}. Aborting.`);
            throw new Error(`Rule ${ruleId} not found in organization ${organizationId}`);
          }

          // Create execution record in STARTED status
          const executionRecord = await this.prisma.automationExecution.create({
            data: {
              automationExecutionId,
              organizationId,
              ruleId,
              triggerEvent: rule.triggerEvent,
              triggerEntityType: entityType,
              triggerEntityId: entityId,
              status: AutomationExecutionStatus.STARTED,
              startedAt: new Date(),
              metadata: {
                ruleVersion: rule.version,
                loopDepth,
              },
            },
          });

          try {
            // Execute actions
            const result = await this.executor.executeRule(rule, data);

            if (result && result.skipped) {
              await this.prisma.automationExecution.update({
                where: { id: executionRecord.id },
                data: {
                  status: AutomationExecutionStatus.SKIPPED,
                  completedAt: new Date(),
                  metadata: {
                    ...(executionRecord.metadata as any || {}),
                    skippedReason: result.reason,
                  },
                },
              });
              this.logger.log(`[Execution Trace: ${automationExecutionId}] Rule ${rule.name} (v${rule.version}) execution skipped: ${result.reason}`);
              return { success: true, skipped: true };
            }

            // Update execution record to SUCCESS
            await this.prisma.automationExecution.update({
              where: { id: executionRecord.id },
              data: {
                status: AutomationExecutionStatus.SUCCESS,
                completedAt: new Date(),
              },
            });

            // Reset consecutive failure count on the rule
            await this.prisma.automationRule.update({
              where: { id: rule.id },
              data: {
                failureCount: 0,
              },
            });

            this.logger.log(`[Execution Trace: ${automationExecutionId}] Rule ${rule.name} (v${rule.version}) executed successfully.`);
            return { success: true };
          } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.error(`[Execution Trace: ${automationExecutionId}] Rule execution failed: ${errorMessage}`, err.stack);

            // Update execution record to FAILED
            await this.prisma.automationExecution.update({
              where: { id: executionRecord.id },
              data: {
                status: AutomationExecutionStatus.FAILED,
                completedAt: new Date(),
                errorMessage: errorMessage.substring(0, 1000), // Avoid overflowing db strings
              },
            });

            // Increment failure count on rule
            await this.prisma.automationRule.update({
              where: { id: rule.id },
              data: {
                failureCount: { increment: 1 },
                lastFailureAt: new Date(),
              },
            });

            throw err; // Throw to trigger BullMQ retries and failure event
          }
        },
      );
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(`[Queue Failure] Job "${job.name}" (ID: ${job.id}) in queue "automations" failed on attempt ${job.attemptsMade} with error: ${error.message}`);
    const attemptsAllowed = job.opts.attempts || 1;
    if (job.attemptsMade >= attemptsAllowed) {
      this.logger.warn(`Job ${job.id} in 'automations' queue failed after ${job.attemptsMade} attempts. Sending to dead-letter queue.`);
      await this.deadLetterQueue.add('dead-letter-job', {
        originalQueue: 'automations',
        jobId: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason || error.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      this.logger.log(`Job ${job.id} failed. Attempt ${job.attemptsMade}/${attemptsAllowed}. Will retry.`);
    }
  }
}
