import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivitiesModule } from '../activities/activities.module';
import { QueueModule } from '../queue/queue.module';
import { TasksModule } from '../tasks/tasks.module';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { AutomationEventListener } from './automation-event.listener';
import { AutomationConsumer } from '../queue/consumers/automation.consumer';
import { AutomationExecutorService } from './executor/automation-executor.service';
import { TemplateResolverService } from './executor/template-resolver.service';

@Module({
  imports: [
    DatabaseModule,
    ActivitiesModule,
    QueueModule,
    forwardRef(() => TasksModule),
  ],
  controllers: [AutomationsController],
  providers: [
    AutomationsService,
    AutomationEventListener,
    AutomationConsumer,
    AutomationExecutorService,
    TemplateResolverService,
  ],
  exports: [
    AutomationsService,
    AutomationExecutorService,
  ],
})
export class AutomationsModule {}
