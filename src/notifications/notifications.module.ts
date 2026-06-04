import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationEventListener } from './notification-event.listener';
import { QueueModule } from '../queue/queue.module';
import { NotificationConsumer } from '../queue/consumers/notification.consumer';

@Module({
  imports: [QueueModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventListener, NotificationConsumer],
  exports: [NotificationService],
})
export class NotificationsModule {}
