import { AutomationTrigger, AutomationActionType } from '@prisma/client';

export interface TemplateAction {
  actionType: AutomationActionType;
  configurationJson: Record<string, any>;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Leads' | 'Sales' | 'Customer Success' | 'Operations';
  icon: string; // Lucide icon identifier
  triggerEvent: AutomationTrigger;
  conditionsJson: any[] | null;
  actions: TemplateAction[];
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'new-lead-follow-up',
    name: 'New Lead Follow Up',
    description: 'Create a follow-up task immediately when a new contact is created as a Lead.',
    category: 'Leads',
    icon: 'UserCheck',
    triggerEvent: AutomationTrigger.CONTACT_CREATED,
    conditionsJson: [
      {
        field: 'contact.status',
        operator: 'EQUALS',
        value: 'LEAD',
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.CREATE_TASK,
        configurationJson: {
          title: 'Initial Follow-up: {{ contact.name }}',
          description: 'Reach out to {{ contact.name }} ({{ contact.email }}) within 24 hours of registration.',
          priority: 'HIGH',
          dueDateOffsetDays: 1,
          assigneeId: 'OWNER',
        },
      },
    ],
  },
  {
    id: 'welcome-new-customer',
    name: 'Welcome New Customer',
    description: 'Send a welcoming onboarding email to a contact when a deal is won.',
    category: 'Customer Success',
    icon: 'MailOpen',
    triggerEvent: AutomationTrigger.DEAL_WON,
    conditionsJson: null,
    actions: [
      {
        actionType: AutomationActionType.SEND_EMAIL,
        configurationJson: {
          to: 'CONTACT',
          subject: 'Welcome to the Family, {{ contact.name }}!',
          body: '<h3>Hi {{ contact.name }},</h3><p>We are absolutely thrilled to welcome you. Our onboarding team will connect with you shortly to set up your account and walk you through the system.</p><p>Best regards,<br/>Client Services Team</p>',
        },
      },
    ],
  },
  {
    id: 'deal-won-celebration',
    name: 'Deal Won Celebration',
    description: 'Post a system notification and notify the sales team when a deal is won.',
    category: 'Sales',
    icon: 'Award',
    triggerEvent: AutomationTrigger.DEAL_WON,
    conditionsJson: null,
    actions: [
      {
        actionType: AutomationActionType.SEND_NOTIFICATION,
        configurationJson: {
          title: '🏆 Deal Won: {{ deal.title }}',
          message: 'Excellent job! Deal "{{ deal.title }}" has been marked WON for {{ deal.value }}.',
          userId: 'ACTOR',
        },
      },
    ],
  },
  {
    id: 'deal-lost-recovery',
    name: 'Deal Lost Recovery',
    description: 'Trigger a follow-up task and schedule a diagnostic review email when a deal is closed lost.',
    category: 'Sales',
    icon: 'RefreshCw',
    triggerEvent: AutomationTrigger.DEAL_STAGE_CHANGED,
    conditionsJson: [
      {
        field: 'deal.stage',
        operator: 'EQUALS',
        value: 'LOST',
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.CREATE_TASK,
        configurationJson: {
          title: 'De-brief: {{ deal.title }}',
          description: 'Conduct a follow-up analysis on why this deal was lost and log findings.',
          priority: 'MEDIUM',
          dueDateOffsetDays: 3,
          assigneeId: 'OWNER',
        },
      },
    ],
  },
  {
    id: 'contact-re-engagement',
    name: 'Contact Re-engagement',
    description: 'Notify the contact owner to follow up with a lead that has churned.',
    category: 'Leads',
    icon: 'PhoneCall',
    triggerEvent: AutomationTrigger.CONTACT_CREATED,
    conditionsJson: [
      {
        field: 'contact.status',
        operator: 'EQUALS',
        value: 'CHURNED',
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.SEND_NOTIFICATION,
        configurationJson: {
          title: 'Re-engage Contact: {{ contact.name }}',
          message: 'Contact {{ contact.name }} status changed to Churned. Please establish re-engagement touchpoint.',
          userId: 'OWNER',
        },
      },
    ],
  },
  {
    id: 'create-follow-up-task',
    name: 'Create Follow-Up Task',
    description: 'Generate a routine follow-up task whenever a new deal is registered in the system.',
    category: 'Operations',
    icon: 'CheckSquare',
    triggerEvent: AutomationTrigger.DEAL_CREATED,
    conditionsJson: null,
    actions: [
      {
        actionType: AutomationActionType.CREATE_TASK,
        configurationJson: {
          title: 'Establish touchpoint: {{ deal.title }}',
          description: 'Schedule introduction call for deal: {{ deal.title }}.',
          priority: 'MEDIUM',
          dueDateOffsetDays: 2,
          assigneeId: 'OWNER',
        },
      },
    ],
  },
  {
    id: 'notify-sales-manager',
    name: 'Notify Sales Manager',
    description: 'Notify the business owner/actor when a high-value opportunity is created.',
    category: 'Operations',
    icon: 'Bell',
    triggerEvent: AutomationTrigger.DEAL_CREATED,
    conditionsJson: [
      {
        field: 'deal.value',
        operator: 'GREATER_THAN',
        value: 10000,
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.SEND_NOTIFICATION,
        configurationJson: {
          title: '🔔 Alert: High-Value Deal Created',
          message: 'A high-value opportunity "{{ deal.title }}" has been created with a value of {{ deal.value }}.',
          userId: 'ACTOR',
        },
      },
    ],
  },
  {
    id: 'high-value-deal-alert',
    name: 'High Value Deal Alert',
    description: 'Send an email alert to the team when a massive deal is closed successfully.',
    category: 'Sales',
    icon: 'TrendingUp',
    triggerEvent: AutomationTrigger.DEAL_WON,
    conditionsJson: [
      {
        field: 'deal.value',
        operator: 'GREATER_THAN',
        value: 50000,
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.SEND_EMAIL,
        configurationJson: {
          to: 'OWNER',
          subject: '🔥 HIGH VALUE DEAL WON: {{ deal.title }}!',
          body: '<h2>Congratulations Team!</h2><p>We just closed a major deal: <strong>{{ deal.title }}</strong> worth <strong>${{ deal.value }}</strong>.</p><p>Account Owner: {{ actor.name }}</p>',
        },
      },
    ],
  },
  {
    id: 'customer-onboarding',
    name: 'Customer Onboarding Pipeline',
    description: 'Auto-create onboarding tasks when a customer profile is set up.',
    category: 'Customer Success',
    icon: 'Users',
    triggerEvent: AutomationTrigger.CONTACT_CREATED,
    conditionsJson: [
      {
        field: 'contact.status',
        operator: 'EQUALS',
        value: 'CUSTOMER',
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.CREATE_TASK,
        configurationJson: {
          title: 'Setup Customer Portal: {{ contact.name }}',
          description: 'Provision onboarding sandbox and user credentials for {{ contact.name }}.',
          priority: 'HIGH',
          dueDateOffsetDays: 1,
          assigneeId: 'OWNER',
        },
      },
    ],
  },
  {
    id: 'task-escalation-reminder',
    name: 'Task Escalation Reminder',
    description: 'Send a notification alert when a task is completed, to keep dependent flows updated.',
    category: 'Operations',
    icon: 'AlertCircle',
    triggerEvent: AutomationTrigger.TASK_COMPLETED,
    conditionsJson: [
      {
        field: 'task.status',
        operator: 'EQUALS',
        value: 'DONE',
      },
    ],
    actions: [
      {
        actionType: AutomationActionType.SEND_NOTIFICATION,
        configurationJson: {
          title: 'Task Finished: {{ task.title }}',
          message: 'Task "{{ task.title }}" has been marked completed by {{ actor.name }}.',
          userId: 'OWNER',
        },
      },
    ],
  },
];
