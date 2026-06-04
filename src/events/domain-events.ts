export enum DomainEventType {
  CONTACT_CREATED = 'CONTACT_CREATED',
  CONTACT_UPDATED = 'CONTACT_UPDATED',
  CONTACT_DELETED = 'CONTACT_DELETED',

  DEAL_CREATED = 'DEAL_CREATED',
  DEAL_UPDATED = 'DEAL_UPDATED',
  DEAL_STAGE_CHANGED = 'DEAL_STAGE_CHANGED',
  DEAL_WON = 'DEAL_WON',
  DEAL_LOST = 'DEAL_LOST',

  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_DUE = 'TASK_DUE',

  USER_INVITED = 'USER_INVITED',
  INVITE_ACCEPTED = 'INVITE_ACCEPTED',

  WORKSPACE_SWITCHED = 'WORKSPACE_SWITCHED',
}

export interface ContactCreatedPayload {
  contactId: string;
  organizationId: string;
  userId: string;
  name: string;
}

export interface ContactUpdatedPayload {
  contactId: string;
  organizationId: string;
  userId: string;
  changes: string;
}

export interface ContactDeletedPayload {
  contactId: string;
  organizationId: string;
  userId: string;
}

export interface DealCreatedPayload {
  dealId: string;
  organizationId: string;
  userId: string;
  title: string;
  value: number;
}

export interface DealUpdatedPayload {
  dealId: string;
  organizationId: string;
  userId: string;
  changes: string;
}

export interface DealStageChangedPayload {
  dealId: string;
  organizationId: string;
  userId: string;
  fromStage: string;
  toStage: string;
}

export interface DealWonPayload {
  dealId: string;
  organizationId: string;
  userId: string;
  value: number;
}

export interface DealLostPayload {
  dealId: string;
  organizationId: string;
  userId: string;
  value: number;
}

export interface TaskCreatedPayload {
  taskId: string;
  organizationId: string;
  userId: string;
  title: string;
}

export interface TaskUpdatedPayload {
  taskId: string;
  organizationId: string;
  userId: string;
  changes: string;
}

export interface TaskCompletedPayload {
  taskId: string;
  organizationId: string;
  userId: string;
}

export interface UserInvitedPayload {
  inviteId: string;
  organizationId: string;
  invitedById: string;
  email: string;
  roleId: string;
}

export interface InviteAcceptedPayload {
  inviteId: string;
  organizationId: string;
  userId: string;
  roleId: string;
}

export interface WorkspaceSwitchedPayload {
  userId: string;
  fromOrganizationId: string | null;
  toOrganizationId: string;
}

export interface TaskAssignedPayload {
  taskId: string;
  assigneeId: string;
  assignedById: string;
  organizationId: string;
  title: string;
}

export interface TaskDuePayload {
  taskId: string;
  userId: string;
  organizationId: string;
  dueDate: Date;
  title: string;
}

export interface DomainEventPayloads {
  [DomainEventType.CONTACT_CREATED]: ContactCreatedPayload;
  [DomainEventType.CONTACT_UPDATED]: ContactUpdatedPayload;
  [DomainEventType.CONTACT_DELETED]: ContactDeletedPayload;

  [DomainEventType.DEAL_CREATED]: DealCreatedPayload;
  [DomainEventType.DEAL_UPDATED]: DealUpdatedPayload;
  [DomainEventType.DEAL_STAGE_CHANGED]: DealStageChangedPayload;
  [DomainEventType.DEAL_WON]: DealWonPayload;
  [DomainEventType.DEAL_LOST]: DealLostPayload;

  [DomainEventType.TASK_CREATED]: TaskCreatedPayload;
  [DomainEventType.TASK_UPDATED]: TaskUpdatedPayload;
  [DomainEventType.TASK_COMPLETED]: TaskCompletedPayload;
  [DomainEventType.TASK_ASSIGNED]: TaskAssignedPayload;
  [DomainEventType.TASK_DUE]: TaskDuePayload;

  [DomainEventType.USER_INVITED]: UserInvitedPayload;
  [DomainEventType.INVITE_ACCEPTED]: InviteAcceptedPayload;

  [DomainEventType.WORKSPACE_SWITCHED]: WorkspaceSwitchedPayload;
}
