import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('dead-letter')
export class DeadLetterConsumer extends WorkerHost {
  private readonly logger = new Logger(DeadLetterConsumer.name);

  async process(job: Job<any, any, string>): Promise<any> {
    const { originalQueue, jobId, name, data, failedReason, timestamp } = job.data;
    this.logger.error(
      `[Dead Letter Queue] Received job ${jobId} (name: "${name}") from queue "${originalQueue}". ` +
      `Failed at ${timestamp} with reason: "${failedReason}". Payload: ${JSON.stringify(data)}`
    );
    // In production, this can be stored in the DB, sent to Sentry, or alert Slack.
  }
}
