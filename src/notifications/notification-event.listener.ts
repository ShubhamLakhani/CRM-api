import { Injectable, Logger } from '@nestjs/common';
import { OnDomainEvent } from '../events/domain-event.decorator';
import { DomainEventType } from '../events/domain-events';
import type { TaskAssignedPayload, TaskDuePayload, DealWonPayload, UserInvitedPayload } from '../events/domain-events';
import { NotificationProducerService } from '../queue/producers/notification-producer.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(
    private readonly notificationProducer: NotificationProducerService,
    private readonly prisma: PrismaService,
  ) {}

  @OnDomainEvent(DomainEventType.TASK_ASSIGNED)
  async onTaskAssigned(payload: TaskAssignedPayload) {
    this.logger.log(`Received TASK_ASSIGNED domain event for task ${payload.taskId}`);
    await this.notificationProducer.addJob('create-notification', {
      userId: payload.assigneeId,
      organizationId: payload.organizationId,
      event: 'TASK_ASSIGNED',
      title: 'New Task Assigned',
      message: `You have been assigned to task: "${payload.title}".`,
    });
  }

  @OnDomainEvent(DomainEventType.TASK_DUE)
  async onTaskDue(payload: TaskDuePayload) {
    this.logger.log(`Received TASK_DUE domain event for task ${payload.taskId}`);
    await this.notificationProducer.addJob('create-notification', {
      userId: payload.userId,
      organizationId: payload.organizationId,
      event: 'TASK_DUE',
      title: 'Task Due Soon',
      message: `Your task "${payload.title}" is due soon.`,
    });
  }

  @OnDomainEvent(DomainEventType.DEAL_WON)
  async onDealWon(payload: DealWonPayload) {
    this.logger.log(`Received DEAL_WON domain event for deal ${payload.dealId}`);
    const deal = await this.prisma.deal.findUnique({
      where: { id: payload.dealId },
    });
    const dealTitle = deal ? deal.title : 'Unknown Deal';

    await this.notificationProducer.addJob('create-notification', {
      userId: payload.userId,
      organizationId: payload.organizationId,
      event: 'DEAL_WON',
      title: 'Deal Won!',
      message: `Congratulations! The deal "${dealTitle}" has been marked as WON for $${payload.value}.`,
    });
  }

  @OnDomainEvent(DomainEventType.USER_INVITED)
  async onUserInvited(payload: UserInvitedPayload) {
    this.logger.log(`Received USER_INVITED domain event for email ${payload.email}`);
    const user = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (user) {
      await this.notificationProducer.addJob('create-notification', {
        userId: user.id,
        organizationId: payload.organizationId,
        event: 'USER_INVITED',
        title: 'Workspace Invitation',
        message: `You have been invited to join another organization.`,
      });
    } else {
      await this.notificationProducer.addJob('create-notification', {
        userId: payload.invitedById,
        organizationId: payload.organizationId,
        event: 'USER_INVITED',
        title: 'Invitation Sent',
        message: `Invitation successfully sent to ${payload.email}.`,
      });
    }
  }
}
