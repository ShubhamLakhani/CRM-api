import { Injectable, Logger } from '@nestjs/common';
import { OnDomainEvent } from '../events/domain-event.decorator';
import { DomainEventType } from '../events/domain-events';
import { AutomationProducerService } from '../queue/producers/automation-producer.service';
import { randomUUID } from 'crypto';
import type {
  ContactCreatedPayload,
  DealCreatedPayload,
  DealStageChangedPayload,
  DealWonPayload,
  TaskCompletedPayload,
  UserInvitedPayload,
} from '../events/domain-events';

@Injectable()
export class AutomationEventListener {
  private readonly logger = new Logger(AutomationEventListener.name);

  constructor(
    private readonly automationProducer: AutomationProducerService,
  ) {}

  @OnDomainEvent(DomainEventType.CONTACT_CREATED)
  async onContactCreated(payload: ContactCreatedPayload) {
    const traceId = randomUUID();
    this.logger.log(`[Trace: ${traceId}] Capture CONTACT_CREATED event for contact ${payload.contactId}`);
    await this.automationProducer.addJob('process-trigger', {
      automationExecutionId: traceId,
      triggerEvent: 'CONTACT_CREATED',
      organizationId: payload.organizationId,
      actorId: payload.userId,
      entityId: payload.contactId,
      entityType: 'contact',
      payload,
    });
  }

  @OnDomainEvent(DomainEventType.DEAL_CREATED)
  async onDealCreated(payload: DealCreatedPayload) {
    const traceId = randomUUID();
    this.logger.log(`[Trace: ${traceId}] Capture DEAL_CREATED event for deal ${payload.dealId}`);
    await this.automationProducer.addJob('process-trigger', {
      automationExecutionId: traceId,
      triggerEvent: 'DEAL_CREATED',
      organizationId: payload.organizationId,
      actorId: payload.userId,
      entityId: payload.dealId,
      entityType: 'deal',
      payload,
    });
  }

  @OnDomainEvent(DomainEventType.DEAL_STAGE_CHANGED)
  async onDealStageChanged(payload: DealStageChangedPayload) {
    const traceId = randomUUID();
    this.logger.log(`[Trace: ${traceId}] Capture DEAL_STAGE_CHANGED event for deal ${payload.dealId}`);
    await this.automationProducer.addJob('process-trigger', {
      automationExecutionId: traceId,
      triggerEvent: 'DEAL_STAGE_CHANGED',
      organizationId: payload.organizationId,
      actorId: payload.userId,
      entityId: payload.dealId,
      entityType: 'deal',
      payload,
    });
  }

  @OnDomainEvent(DomainEventType.DEAL_WON)
  async onDealWon(payload: DealWonPayload) {
    const traceId = randomUUID();
    this.logger.log(`[Trace: ${traceId}] Capture DEAL_WON event for deal ${payload.dealId}`);
    await this.automationProducer.addJob('process-trigger', {
      automationExecutionId: traceId,
      triggerEvent: 'DEAL_WON',
      organizationId: payload.organizationId,
      actorId: payload.userId,
      entityId: payload.dealId,
      entityType: 'deal',
      payload,
    });
  }

  @OnDomainEvent(DomainEventType.TASK_COMPLETED)
  async onTaskCompleted(payload: TaskCompletedPayload) {
    const traceId = randomUUID();
    this.logger.log(`[Trace: ${traceId}] Capture TASK_COMPLETED event for task ${payload.taskId}`);
    await this.automationProducer.addJob('process-trigger', {
      automationExecutionId: traceId,
      triggerEvent: 'TASK_COMPLETED',
      organizationId: payload.organizationId,
      actorId: payload.userId,
      entityId: payload.taskId,
      entityType: 'task',
      payload,
    });
  }

  @OnDomainEvent(DomainEventType.USER_INVITED)
  async onUserInvited(payload: UserInvitedPayload) {
    const traceId = randomUUID();
    this.logger.log(`[Trace: ${traceId}] Capture USER_INVITED event for invite ${payload.inviteId}`);
    await this.automationProducer.addJob('process-trigger', {
      automationExecutionId: traceId,
      triggerEvent: 'USER_INVITED',
      organizationId: payload.organizationId,
      actorId: payload.invitedById,
      entityId: payload.inviteId,
      entityType: 'invite',
      payload,
    });
  }
}
