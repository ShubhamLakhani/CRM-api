import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, JobsOptions } from 'bullmq';

@Injectable()
export class AutomationProducerService {
  private readonly logger = new Logger(AutomationProducerService.name);

  constructor(
    @InjectQueue('automations') private readonly queue: Queue,
  ) {}

  async addJob(name: string, data: any, opts?: JobsOptions) {
    const defaultOpts: JobsOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      ...opts,
    };
    this.logger.log(`[Queue Enqueue] Enqueuing job "${name}" to queue "automations" with data: ${JSON.stringify(data)}`);
    return this.queue.add(name, data, defaultOpts);
  }

  getQueue(): Queue {
    return this.queue;
  }
}
