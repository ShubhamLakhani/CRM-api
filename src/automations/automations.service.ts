import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ActivityService } from '../activities/activity.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

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

  async create(createDto: CreateAutomationRuleDto, creatorId: string, organizationId: string) {
    const { name, description, triggerEvent, conditionsJson, isEnabled, actions } = createDto;

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
}
