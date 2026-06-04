import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationService } from '../../notifications/notification.service';

@Processor('notifications')
export class NotificationConsumer extends WorkerHost {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(
    @InjectQueue('dead-letter') private readonly deadLetterQueue: Queue,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[Queue Processing] Processing job "${job.name}" (ID: ${job.id}) in queue "notifications" on attempt ${job.attemptsMade} with data: ${JSON.stringify(job.data)}`);
    const { userId, organizationId, event, title, message, entityType, entityId } = job.data;
    await this.notificationService.createNotification(
      userId,
      organizationId,
      event,
      title,
      message,
      entityType,
      entityId,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    this.logger.error(`[Queue Failure] Job "${job.name}" (ID: ${job.id}) in queue "notifications" failed on attempt ${job.attemptsMade} with error: ${error.message}`);
    const attemptsAllowed = job.opts.attempts || 1;
    if (job.attemptsMade >= attemptsAllowed) {
      this.logger.warn(`Job ${job.id} in 'notifications' queue failed after ${job.attemptsMade} attempts. Sending to dead-letter queue.`);
      await this.deadLetterQueue.add('dead-letter-job', {
        originalQueue: 'notifications',
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
