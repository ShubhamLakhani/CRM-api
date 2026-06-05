import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RequestContextInterceptor } from './common/request-context';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { DealsModule } from './deals/deals.module';
import { CompaniesModule } from './companies/companies.module';
import { TasksModule } from './tasks/tasks.module';
import { InvitationsModule } from './invitations/invitations.module';
import { FeaturesModule } from './features/features.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { EventsModule } from './events/events.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivitiesModule } from './activities/activities.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    EventsModule,
    ConfigModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    NotificationsModule,
    ActivitiesModule,
    AuditLogsModule,
    AuthModule,
    ContactsModule,
    DealsModule,
    CompaniesModule,
    TasksModule,
    InvitationsModule,
    FeaturesModule,
    OrganizationsModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests per minute globally
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}

