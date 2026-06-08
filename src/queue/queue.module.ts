import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationProducerService } from './producers/notification-producer.service';
import { EmailProducerService } from './producers/email-producer.service';
import { AutomationProducerService } from './producers/automation-producer.service';
import { EmailConsumer } from './consumers/email.consumer';
import { DeadLetterConsumer } from './consumers/dead-letter.consumer';
import { QueueController } from './queue.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    EmailModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redisHost', 'localhost'),
          port: configService.get<number>('redisPort', 6379),
          password: configService.get<string>('redisPassword'),
          db: configService.get<number>('redisDb', 0),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'emails' },
      { name: 'automations' },
      { name: 'dead-letter' },
    ),
  ],
  controllers: [QueueController],
  providers: [
    NotificationProducerService,
    EmailProducerService,
    AutomationProducerService,
    EmailConsumer,
    DeadLetterConsumer,
  ],
  exports: [
    BullModule,
    NotificationProducerService,
    EmailProducerService,
    AutomationProducerService,
  ],
})
export class QueueModule {}
