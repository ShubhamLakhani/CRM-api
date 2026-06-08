import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { PlanEntitlementService } from './entitlement.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PlanEntitlementService],
  exports: [SubscriptionService, PlanEntitlementService],
})
export class SubscriptionModule {}
