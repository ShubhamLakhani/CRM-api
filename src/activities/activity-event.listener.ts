import { Injectable, Logger } from '@nestjs/common';
import { OnDomainEvent } from '../events/domain-event.decorator';
import { DomainEventType } from '../events/domain-events';
import type {
  ContactCreatedPayload,
  ContactUpdatedPayload,
  CompanyCreatedPayload,
  CompanyUpdatedPayload,
  DealCreatedPayload,
  DealUpdatedPayload,
  DealStageChangedPayload,
  DealWonPayload,
  DealLostPayload,
  TaskCreatedPayload,
  TaskCompletedPayload,
  TaskUpdatedPayload,
  TaskAssignedPayload,
  UserInvitedPayload,
  InviteAcceptedPayload,
} from '../events/domain-events';
import { ActivityService } from './activity.service';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ActivityEventListener {
  private readonly logger = new Logger(ActivityEventListener.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly prisma: PrismaService,
  ) {}

  private async getActorName(userId?: string | null): Promise<string> {
    if (!userId) return 'System';
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user ? user.name : 'Unknown User';
  }

  private formatRupees(value: number): string {
    const formatter = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    });
    return `₹${formatter.format(value)}`;
  }

  private toTitleCase(str: string): string {
    if (!str) return '';
    return str
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  @OnDomainEvent(DomainEventType.CONTACT_CREATED)
  async onContactCreated(payload: ContactCreatedPayload) {
    this.logger.log(`Logging activity for CONTACT_CREATED: ${payload.contactId}`);
    const actorName = await this.getActorName(payload.userId);
    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'contact',
      payload.contactId,
      'created',
      `${payload.name} was created`,
      `Created by ${actorName}`,
      { contactId: payload.contactId, name: payload.name },
    );
  }

  @OnDomainEvent(DomainEventType.CONTACT_UPDATED)
  async onContactUpdated(payload: ContactUpdatedPayload) {
    this.logger.log(`Logging activity for CONTACT_UPDATED: ${payload.contactId}`);
    const contact = await this.prisma.contact.findUnique({
      where: { id: payload.contactId },
      select: { name: true },
    });
    const contactName = contact ? contact.name : 'Unknown Contact';
    const actorName = await this.getActorName(payload.userId);

    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'CONTACT',
        entityId: payload.contactId,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    const before = auditLog?.before as any;
    const after = auditLog?.after as any;

    let title = `${contactName} was updated`;
    let description = `Updated by ${actorName}`;

    if (before && after) {
      const changesList: string[] = [];
      let statusChanged = false;

      if (before.status !== after.status) {
        statusChanged = true;
        changesList.push(`Status changed from ${this.toTitleCase(before.status)} to ${this.toTitleCase(after.status)}`);
      }
      if (before.email !== after.email) {
        changesList.push('Email updated');
      }
      if (before.name !== after.name) {
        changesList.push('Name updated');
      }
      if (before.phone !== after.phone) {
        changesList.push('Phone updated');
      }
      if (before.ownerId !== after.ownerId) {
        if (after.ownerId) {
          const newOwner = await this.prisma.user.findUnique({
            where: { id: after.ownerId },
            select: { name: true },
          });
          changesList.push(`Assigned to ${newOwner ? newOwner.name : 'Unknown User'}`);
        } else {
          changesList.push('Owner removed');
        }
      }
      if (before.companyId !== after.companyId) {
        if (after.companyId) {
          const company = await this.prisma.company.findUnique({
            where: { id: after.companyId },
            select: { name: true },
          });
          if (company) {
            changesList.push(`Linked to ${company.name}`);
          } else {
            changesList.push('Company updated');
          }
        } else if (before.companyId) {
          const company = await this.prisma.company.findUnique({
            where: { id: before.companyId },
            select: { name: true },
          });
          changesList.push(`Unlinked from ${company ? company.name : 'Company'}`);
        } else {
          changesList.push('Company updated');
        }
      }

      if (statusChanged) {
        title = `${contactName} status changed`;
      }

      if (changesList.length > 0) {
        description = changesList.join('\n');
      }
    }

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'contact',
      payload.contactId,
      'updated',
      title,
      description,
      { contactId: payload.contactId, changes: payload.changes },
    );
  }

  @OnDomainEvent(DomainEventType.COMPANY_CREATED)
  async onCompanyCreated(payload: CompanyCreatedPayload) {
    this.logger.log(`Logging activity for COMPANY_CREATED: ${payload.companyId}`);
    const actorName = await this.getActorName(payload.userId);
    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'company',
      payload.companyId,
      'created',
      `${payload.name} was created`,
      `Created by ${actorName}`,
      { companyId: payload.companyId, name: payload.name },
    );
  }

  @OnDomainEvent(DomainEventType.COMPANY_UPDATED)
  async onCompanyUpdated(payload: CompanyUpdatedPayload) {
    this.logger.log(`Logging activity for COMPANY_UPDATED: ${payload.companyId}`);
    const company = await this.prisma.company.findUnique({
      where: { id: payload.companyId },
      select: { name: true },
    });
    const companyName = company ? company.name : 'Unknown Company';
    const actorName = await this.getActorName(payload.userId);

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'company',
      payload.companyId,
      'updated',
      `${companyName} was updated`,
      `Updated by ${actorName}`,
      { companyId: payload.companyId, changes: payload.changes },
    );
  }

  @OnDomainEvent(DomainEventType.DEAL_CREATED)
  async onDealCreated(payload: DealCreatedPayload) {
    this.logger.log(`Logging activity for DEAL_CREATED: ${payload.dealId}`);
    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'deal',
      payload.dealId,
      'created',
      `${payload.title} was created`,
      `Pipeline value ${this.formatRupees(payload.value)}`,
      { dealId: payload.dealId, title: payload.title, value: payload.value },
    );
  }

  @OnDomainEvent(DomainEventType.DEAL_UPDATED)
  async onDealUpdated(payload: DealUpdatedPayload) {
    this.logger.log(`Logging activity for DEAL_UPDATED: ${payload.dealId}`);
    const deal = await this.prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { title: true },
    });
    const dealTitle = deal ? deal.title : 'Unknown Deal';
    const actorName = await this.getActorName(payload.userId);

    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'DEAL',
        entityId: payload.dealId,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    const before = auditLog?.before as any;
    const after = auditLog?.after as any;

    let title = `${dealTitle} was updated`;
    let description = `Updated by ${actorName}`;

    if (before && after) {
      const changesList: string[] = [];

      if (before.title !== after.title) {
        changesList.push('Title updated');
      }
      if (before.value !== after.value) {
        changesList.push(`Value changed from ${this.formatRupees(before.value || 0)} to ${this.formatRupees(after.value || 0)}`);
      }
      if (before.ownerId !== after.ownerId) {
        if (after.ownerId) {
          const newOwner = await this.prisma.user.findUnique({
            where: { id: after.ownerId },
            select: { name: true },
          });
          changesList.push(`Assigned to ${newOwner ? newOwner.name : 'Unknown User'}`);
        } else {
          changesList.push('Owner removed');
        }
      }
      if (before.companyId !== after.companyId) {
        if (after.companyId) {
          const company = await this.prisma.company.findUnique({
            where: { id: after.companyId },
            select: { name: true },
          });
          if (company) {
            changesList.push(`Linked to Company ${company.name}`);
          }
        } else if (before.companyId) {
          const company = await this.prisma.company.findUnique({
            where: { id: before.companyId },
            select: { name: true },
          });
          changesList.push(`Unlinked from Company ${company ? company.name : 'Company'}`);
        }
      }
      if (before.contactId !== after.contactId) {
        if (after.contactId) {
          const contact = await this.prisma.contact.findUnique({
            where: { id: after.contactId },
            select: { name: true },
          });
          if (contact) {
            changesList.push(`Linked to Contact ${contact.name}`);
          }
        } else if (before.contactId) {
          const contact = await this.prisma.contact.findUnique({
            where: { id: before.contactId },
            select: { name: true },
          });
          changesList.push(`Unlinked from Contact ${contact ? contact.name : 'Contact'}`);
        }
      }

      if (changesList.length > 0) {
        description = changesList.join('\n');
      }
    }

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'deal',
      payload.dealId,
      'updated',
      title,
      description,
      { dealId: payload.dealId, changes: payload.changes },
    );
  }

  @OnDomainEvent(DomainEventType.DEAL_STAGE_CHANGED)
  async onDealStageChanged(payload: DealStageChangedPayload) {
    this.logger.log(`Logging activity for DEAL_STAGE_CHANGED: ${payload.dealId}`);
    const deal = await this.prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { title: true },
    });
    const dealTitle = deal ? deal.title : 'Unknown Deal';

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'deal',
      payload.dealId,
      'stage_changed',
      `${dealTitle} moved to ${this.toTitleCase(payload.toStage)}`,
      `Stage changed from ${this.toTitleCase(payload.fromStage)} to ${this.toTitleCase(payload.toStage)}`,
      { dealId: payload.dealId, fromStage: payload.fromStage, toStage: payload.toStage },
    );
  }

  @OnDomainEvent(DomainEventType.DEAL_WON)
  async onDealWon(payload: DealWonPayload) {
    this.logger.log(`Logging activity for DEAL_WON: ${payload.dealId}`);
    const deal = await this.prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { title: true },
    });
    const dealTitle = deal ? deal.title : 'Unknown Deal';

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'deal',
      payload.dealId,
      'won',
      `${dealTitle} was marked as Won`,
      `Deal value ${this.formatRupees(payload.value)}`,
      { dealId: payload.dealId, value: payload.value },
    );
  }

  @OnDomainEvent(DomainEventType.DEAL_LOST)
  async onDealLost(payload: DealLostPayload) {
    this.logger.log(`Logging activity for DEAL_LOST: ${payload.dealId}`);
    const deal = await this.prisma.deal.findUnique({
      where: { id: payload.dealId },
      select: { title: true },
    });
    const dealTitle = deal ? deal.title : 'Unknown Deal';

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'deal',
      payload.dealId,
      'lost',
      `${dealTitle} was marked as Lost`,
      `Deal value ${this.formatRupees(payload.value)}`,
      { dealId: payload.dealId, value: payload.value },
    );
  }

  @OnDomainEvent(DomainEventType.TASK_CREATED)
  async onTaskCreated(payload: TaskCreatedPayload) {
    this.logger.log(`Logging activity for TASK_CREATED: ${payload.taskId}`);
    const actorName = await this.getActorName(payload.userId);
    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'task',
      payload.taskId,
      'created',
      `${payload.title} was created`,
      `Created by ${actorName}`,
      { taskId: payload.taskId, title: payload.title },
    );
  }

  @OnDomainEvent(DomainEventType.TASK_COMPLETED)
  async onTaskCompleted(payload: TaskCompletedPayload) {
    this.logger.log(`Logging activity for TASK_COMPLETED: ${payload.taskId}`);
    const task = await this.prisma.task.findUnique({
      where: { id: payload.taskId },
      select: { title: true },
    });
    const taskTitle = task ? task.title : 'Unknown Task';
    const actorName = await this.getActorName(payload.userId);

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'task',
      payload.taskId,
      'completed',
      `${taskTitle} completed`,
      `Completed by ${actorName}`,
      { taskId: payload.taskId },
    );
  }

  @OnDomainEvent(DomainEventType.TASK_ASSIGNED)
  async onTaskAssigned(payload: TaskAssignedPayload) {
    this.logger.log(`Logging activity for TASK_ASSIGNED: ${payload.taskId}`);
    const actorName = await this.getActorName(payload.assignedById);
    const assignee = await this.prisma.user.findUnique({
      where: { id: payload.assigneeId },
      select: { name: true },
    });
    const assigneeName = assignee ? assignee.name : 'Unknown User';

    await this.activityService.logActivity(
      payload.organizationId,
      payload.assignedById,
      'task',
      payload.taskId,
      'updated',
      `${payload.title} was assigned`,
      `Assigned to ${assigneeName} by ${actorName}`,
      { taskId: payload.taskId, assigneeId: payload.assigneeId },
    );
  }

  @OnDomainEvent(DomainEventType.TASK_UPDATED)
  async onTaskUpdated(payload: TaskUpdatedPayload) {
    this.logger.log(`Logging activity for TASK_UPDATED: ${payload.taskId}`);
    const task = await this.prisma.task.findUnique({
      where: { id: payload.taskId },
      select: { title: true },
    });
    const taskTitle = task ? task.title : 'Unknown Task';
    const actorName = await this.getActorName(payload.userId);

    const auditLog = await this.prisma.auditLog.findFirst({
      where: {
        entityType: 'TASK',
        entityId: payload.taskId,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    const before = auditLog?.before as any;
    const after = auditLog?.after as any;

    let title = `${taskTitle} was updated`;
    let description = `Updated by ${actorName}`;

    if (before && after) {
      const changesList: string[] = [];

      if (before.title !== after.title) {
        changesList.push('Title updated');
      }
      if (before.description !== after.description) {
        changesList.push('Description updated');
      }
      if (before.dueDate !== after.dueDate) {
        changesList.push('Due date updated');
      }
      if (before.priority !== after.priority) {
        changesList.push(`Priority changed from ${this.toTitleCase(before.priority)} to ${this.toTitleCase(after.priority)}`);
      }
      if (before.status !== after.status) {
        changesList.push(`Status changed from ${this.toTitleCase(before.status)} to ${this.toTitleCase(after.status)}`);
      }
      if (before.assigneeId !== after.assigneeId) {
        if (after.assigneeId) {
          const user = await this.prisma.user.findUnique({
            where: { id: after.assigneeId },
            select: { name: true },
          });
          changesList.push(`Assigned to ${user ? user.name : 'Unknown User'}`);
        } else {
          changesList.push('Assignee removed');
        }
      }

      if (changesList.length > 0) {
        description = changesList.join('\n');
      }
    }

    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'task',
      payload.taskId,
      'updated',
      title,
      description,
      { taskId: payload.taskId, changes: payload.changes },
    );
  }

  @OnDomainEvent(DomainEventType.USER_INVITED)
  async onUserInvited(payload: UserInvitedPayload) {
    this.logger.log(`Logging activity for USER_INVITED: ${payload.inviteId}`);
    const actorName = await this.getActorName(payload.invitedById);
    await this.activityService.logActivity(
      payload.organizationId,
      payload.invitedById,
      'user',
      payload.inviteId,
      'invited',
      'User invited',
      `${actorName} invited [${payload.email}](mailto:${payload.email})`,
      { inviteId: payload.inviteId, email: payload.email, roleId: payload.roleId },
    );
  }

  @OnDomainEvent(DomainEventType.INVITE_ACCEPTED)
  async onInviteAccepted(payload: InviteAcceptedPayload) {
    this.logger.log(`Logging activity for INVITE_ACCEPTED: ${payload.inviteId}`);
    const actorName = await this.getActorName(payload.userId);
    await this.activityService.logActivity(
      payload.organizationId,
      payload.userId,
      'user',
      payload.userId,
      'invite_accepted',
      'Invite accepted',
      `${actorName} joined the organization`,
      { inviteId: payload.inviteId, roleId: payload.roleId },
    );
  }
}
