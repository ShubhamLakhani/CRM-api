import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { RedisService } from './redis/redis.service';
import { NotificationProducerService } from './queue/producers/notification-producer.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationProducer: NotificationProducerService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async checkHealth() {
    let dbStatus = 'DOWN';
    let redisStatus = 'DOWN';
    let bullmqStatus = 'DOWN';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'UP';
    } catch (err) {
      this.logger.error(`Postgres health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const pong = await this.redisService.getClient().ping();
      if (pong === 'PONG') {
        redisStatus = 'UP';
      }
    } catch (err) {
      this.logger.error(`Redis health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const counts = await this.notificationProducer.getQueue().getJobCounts();
      if (counts) {
        bullmqStatus = 'UP';
      }
    } catch (err) {
      this.logger.error(`BullMQ health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const overallStatus = dbStatus === 'UP' && redisStatus === 'UP' && bullmqStatus === 'UP' ? 'UP' : 'DOWN';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      postgres: dbStatus,
      redis: redisStatus,
      bullmq: bullmqStatus,
    };
  }
}

