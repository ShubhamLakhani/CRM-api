import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../activities/activity.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { ExecutionsQueryDto } from './dto/executions-query.dto';

export const CONTACT_STATUS_OPTIONS = ['LEAD', 'CONTACTED', 'CUSTOMER', 'CHURNED'];
export const DEAL_STAGE_OPTIONS = ['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
export const TASK_STATUS_OPTIONS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'];

@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  private async getActorName(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user ? user.name : 'Unknown User';
  }

  private async validateActionRecipients(actions: any[], organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const orgUserIds = new Set(members.map((m) => m.userId));

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const action of actions) {
      const config = action.configurationJson || {};
      if (action.actionType === 'CREATE_TASK') {
        const assigneeId = config.assigneeId;
        if (assigneeId && assigneeId !== 'ACTOR' && assigneeId !== 'OWNER') {
          if (!orgUserIds.has(assigneeId)) {
            throw new BadRequestException(`Assignee user ID ${assigneeId} does not belong to this organization`);
          }
        }
      } else if (action.actionType === 'SEND_NOTIFICATION') {
        const userId = config.userId;
        if (userId && userId !== 'ACTOR' && userId !== 'OWNER') {
          if (!orgUserIds.has(userId)) {
            throw new BadRequestException(`Notification recipient user ID ${userId} does not belong to this organization`);
          }
        }
      } else if (action.actionType === 'SEND_EMAIL') {
        const to = config.to;
        if (to && to !== 'ACTOR' && to !== 'OWNER' && to !== 'CONTACT') {
          if (uuidRegex.test(to)) {
            if (!orgUserIds.has(to)) {
              throw new BadRequestException(`Email recipient user ID ${to} does not belong to this organization`);
            }
          }
        }
      }
    }
  }

  async create(createDto: CreateAutomationRuleDto, creatorId: string, organizationId: string) {
    const { name, description, triggerEvent, conditionsJson, isEnabled, actions } = createDto;

    await this.validateActionRecipients(actions, organizationId);

    const rule = await this.prisma.automationRule.create({
      data: {
        organizationId,
        name,
        description,
        triggerEvent,
        conditionsJson: conditionsJson ? JSON.parse(JSON.stringify(conditionsJson)) : undefined,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        version: 1,
        actions: {
          create: actions.map((a) => ({
            actionType: a.actionType,
            configurationJson: JSON.parse(JSON.stringify(a.configurationJson)),
          })),
        },
      },
      include: {
        actions: true,
      },
    });

    const actorName = await this.getActorName(creatorId);
    await this.activityService.logActivity(
      organizationId,
      creatorId,
      'automation_rule',
      rule.id,
      'created',
      'Automation rule created',
      `Rule "${rule.name}" was created by ${actorName}`,
      { ruleId: rule.id },
    );

    return rule;
  }

  async findAll(organizationId: string) {
    return this.prisma.automationRule.findMany({
      where: { organizationId },
      include: { actions: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, organizationId },
      include: { actions: true },
    });

    if (!rule) {
      throw new NotFoundException(`Automation rule with ID ${id} not found in this organization`);
    }

    return rule;
  }

  async update(id: string, updateDto: UpdateAutomationRuleDto, userId: string, organizationId: string) {
    const existing = await this.findOne(id, organizationId);

    const { name, description, triggerEvent, conditionsJson, isEnabled, actions } = updateDto;

    if (actions) {
      await this.validateActionRecipients(actions, organizationId);
    }

    const rule = await this.prisma.$transaction(async (tx) => {
      // If actions are provided, delete the old ones and recreate
      if (actions) {
        await tx.automationAction.deleteMany({
          where: { ruleId: id },
        });
      }

      return tx.automationRule.update({
        where: { id },
        data: {
          name,
          description,
          triggerEvent,
          conditionsJson: conditionsJson !== undefined ? (conditionsJson ? JSON.parse(JSON.stringify(conditionsJson)) : null) : undefined,
          isEnabled,
          version: { increment: 1 },
          actions: actions
            ? {
                create: actions.map((a) => ({
                  actionType: a.actionType,
                  configurationJson: JSON.parse(JSON.stringify(a.configurationJson)),
                })),
              }
            : undefined,
        },
        include: {
          actions: true,
        },
      });
    });

    const actorName = await this.getActorName(userId);
    await this.activityService.logActivity(
      organizationId,
      userId,
      'automation_rule',
      rule.id,
      'updated',
      'Automation rule updated',
      `Rule "${rule.name}" was updated by ${actorName}`,
      { ruleId: rule.id },
    );

    return rule;
  }

  async remove(id: string, userId: string, organizationId: string) {
    const rule = await this.findOne(id, organizationId);

    await this.prisma.automationRule.delete({
      where: { id },
    });

    const actorName = await this.getActorName(userId);
    await this.activityService.logActivity(
      organizationId,
      userId,
      'automation_rule',
      rule.id,
      'deleted',
      'Automation rule deleted',
      `Rule "${rule.name}" was deleted by ${actorName}`,
      { ruleId: rule.id },
    );

    return { success: true };
  }

  async getMetadata(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        user: { deletedAt: null },
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const organizationUsers = members.map((m) => m.user);

    return {
      triggers: [
        { value: 'CONTACT_CREATED', label: 'Contact Created' },
        { value: 'DEAL_CREATED', label: 'Deal Created' },
        { value: 'DEAL_STAGE_CHANGED', label: 'Deal Stage Changed' },
        { value: 'DEAL_WON', label: 'Deal Won' },
        { value: 'TASK_COMPLETED', label: 'Task Completed' },
        { value: 'USER_INVITED', label: 'User Invited' },
      ],
      conditionFields: [
        {
          field: 'contact.name',
          label: 'Contact Name',
          type: 'STRING',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
        },
        {
          field: 'contact.email',
          label: 'Contact Email',
          type: 'STRING',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
        },
        {
          field: 'contact.status',
          label: 'Contact Status',
          type: 'ENUM',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
          options: CONTACT_STATUS_OPTIONS,
        },
        {
          field: 'deal.title',
          label: 'Deal Title',
          type: 'STRING',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
        },
        {
          field: 'deal.value',
          label: 'Deal Value',
          type: 'NUMBER',
          operators: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'IS_EMPTY', 'IS_NOT_EMPTY'],
        },
        {
          field: 'deal.stage',
          label: 'Deal Stage',
          type: 'ENUM',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
          options: DEAL_STAGE_OPTIONS,
        },
        {
          field: 'task.title',
          label: 'Task Title',
          type: 'STRING',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
        },
        {
          field: 'task.status',
          label: 'Task Status',
          type: 'ENUM',
          operators: ['EQUALS', 'NOT_EQUALS', 'CONTAINS', 'IS_EMPTY', 'IS_NOT_EMPTY'],
          options: TASK_STATUS_OPTIONS,
        },
      ],
      actionTypes: [
        {
          value: 'CREATE_TASK',
          label: 'Create Task',
          fields: [
            { name: 'title', label: 'Task Title', type: 'TEMPLATE_STRING', required: true },
            { name: 'description', label: 'Description', type: 'TEMPLATE_STRING', required: false },
            {
              name: 'priority',
              label: 'Priority',
              type: 'SELECT',
              options: ['HIGH', 'MEDIUM', 'LOW', 'NONE'],
              required: false,
              defaultValue: 'MEDIUM',
            },
            { name: 'dueDateOffsetDays', label: 'Due Date Offset (Days)', type: 'NUMBER', required: false },
            {
              name: 'assigneeId',
              label: 'Assignee',
              type: 'SELECT_WITH_DYNAMIC',
              options: [
                { value: 'ACTOR', label: 'Triggering User (Actor)' },
                { value: 'OWNER', label: 'Deal/Contact Owner' },
              ],
              required: true,
            },
          ],
        },
        {
          value: 'SEND_NOTIFICATION',
          label: 'Send In-App Notification',
          fields: [
            { name: 'title', label: 'Notification Title', type: 'TEMPLATE_STRING', required: true },
            { name: 'message', label: 'Notification Message', type: 'TEMPLATE_STRING', required: true },
            {
              name: 'userId',
              label: 'Recipient User',
              type: 'SELECT_WITH_DYNAMIC',
              options: [
                { value: 'ACTOR', label: 'Triggering User (Actor)' },
                { value: 'OWNER', label: 'Deal/Contact Owner' },
              ],
              required: true,
            },
          ],
        },
        {
          value: 'SEND_EMAIL',
          label: 'Send Email via SMTP',
          fields: [
            {
              name: 'to',
              label: 'To (Recipient Email)',
              type: 'SELECT_WITH_DYNAMIC_AND_INPUT',
              options: [
                { value: 'ACTOR', label: 'Triggering User\'s Email' },
                { value: 'OWNER', label: 'Owner\'s Email' },
                { value: 'CONTACT', label: 'Contact\'s Email' },
              ],
              required: true,
            },
            { name: 'subject', label: 'Email Subject', type: 'TEMPLATE_STRING', required: true },
            { name: 'body', label: 'Email HTML Body', type: 'TEMPLATE_STRING', required: true },
          ],
        },
      ],
      organizationUsers,
    };
  }

  async findExecutions(query: ExecutionsQueryDto, organizationId: string) {
    const { ruleId, status } = query;
    const pageNum = Number(query.page || 1);
    const limitNum = Number(query.limit || 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      organizationId,
    };

    if (ruleId) {
      where.ruleId = ruleId;
    }

    if (status) {
      where.status = status;
    }

    const [data, total] = await Promise.all([
      this.prisma.automationExecution.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          rule: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.automationExecution.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    };
  }

  async getStats(ruleId: string | undefined, organizationId: string) {
    const where: any = {
      organizationId,
    };

    if (ruleId) {
      // First verify the rule exists in this tenant
      const ruleExists = await this.prisma.automationRule.findFirst({
        where: { id: ruleId, organizationId },
      });
      if (!ruleExists) {
        throw new NotFoundException(`Automation rule with ID ${ruleId} not found in this organization`);
      }
      where.ruleId = ruleId;
    }

    const aggregates = await this.prisma.automationExecution.groupBy({
      by: ['status'],
      where,
      _count: {
        id: true,
      },
    });

    const stats = {
      STARTED: 0,
      SUCCESS: 0,
      FAILED: 0,
      SKIPPED: 0,
    };

    let totalCount = 0;
    aggregates.forEach((group) => {
      if (group.status in stats) {
        stats[group.status] = group._count.id;
        totalCount += group._count.id;
      }
    });

    const executedCount = stats.SUCCESS + stats.FAILED;
    const successRate = executedCount > 0 ? Number(((stats.SUCCESS / executedCount) * 100).toFixed(2)) : 100.0;

    return {
      totalCount,
      successCount: stats.SUCCESS,
      failedCount: stats.FAILED,
      skippedCount: stats.SKIPPED,
      startedCount: stats.STARTED,
      successRate,
    };
  }
}
