import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { ActivityEventListener } from './activity-event.listener';

@Module({
  controllers: [ActivityController],
  providers: [ActivityService, ActivityEventListener],
  exports: [ActivityService],
})
export class ActivitiesModule {}
