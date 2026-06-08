import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailService } from '../../email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { AutomationExecutionStatus } from '@prisma/client';

@Processor('emails')
export class EmailConsumer extends WorkerHost {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(
    @InjectQueue('dead-letter') private readonly deadLetterQueue: Queue,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[Queue Processing] Processing job "${job.name}" (ID: ${job.id}) in queue "emails" on attempt ${job.attemptsMade} with data: ${JSON.stringify(job.data)}`);
    const { to, subject, body, automationExecutionId } = job.data;
    await this.emailService.sendEmail({
      to,
      subject,
      html: body,
      automationExecutionId,
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(`[Queue Failure] Job "${job.name}" (ID: ${job.id}) in queue "emails" failed on attempt ${job.attemptsMade} with error: ${error.message}`);
    const attemptsAllowed = job.opts.attempts || 1;
    if (job.attemptsMade >= attemptsAllowed) {
      this.logger.warn(`Job ${job.id} in 'emails' queue failed after ${job.attemptsMade} attempts. Sending to dead-letter queue.`);
      
      const automationExecutionId = job.data?.automationExecutionId;
      if (automationExecutionId) {
        try {
          await this.prisma.automationExecution.update({
            where: { automationExecutionId },
            data: {
              status: AutomationExecutionStatus.FAILED,
              errorMessage: `Email delivery failed: ${error.message}`,
              completedAt: new Date(),
            },
          });
          this.logger.log(`[Execution Trace: ${automationExecutionId}] Email delivery failed`);
        } catch (dbErr: any) {
          this.logger.error(`Failed to update automation execution status to FAILED: ${dbErr.message}`);
        }
      }

      await this.deadLetterQueue.add('dead-letter-job', {
        originalQueue: 'emails',
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
