import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getCurrentSubscription(organizationId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      // Fallback: create default FREE subscription if it does not exist
      subscription = await this.prisma.subscription.create({
        data: {
          organizationId,
          planId: 'FREE',
          status: 'ACTIVE',
        },
        include: { plan: true },
      });
    }

    return subscription;
  }

  async getUsage(organizationId: string) {
    const sub = await this.getCurrentSubscription(organizationId);
    const plan = sub.plan;

    const [userCount, contactCount, dealCount] = await Promise.all([
      this.prisma.organizationMember.count({ where: { organizationId } }),
      this.prisma.contact.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.deal.count({ where: { organizationId, deletedAt: null } }),
    ]);

    // Upsert these values into UsageMetric
    await Promise.all([
      this.prisma.usageMetric.upsert({
        where: { organizationId_metricKey: { organizationId, metricKey: 'USERS' } },
        create: { organizationId, metricKey: 'USERS', value: userCount },
        update: { value: userCount },
      }),
      this.prisma.usageMetric.upsert({
        where: { organizationId_metricKey: { organizationId, metricKey: 'CONTACTS' } },
        create: { organizationId, metricKey: 'CONTACTS', value: contactCount },
        update: { value: contactCount },
      }),
      this.prisma.usageMetric.upsert({
        where: { organizationId_metricKey: { organizationId, metricKey: 'DEALS' } },
        create: { organizationId, metricKey: 'DEALS', value: dealCount },
        update: { value: dealCount },
      }),
    ]);

    return {
      users: {
        usage: userCount,
        limit: plan.maxUsers,
        remaining: Math.max(0, plan.maxUsers - userCount),
      },
      contacts: {
        usage: contactCount,
        limit: plan.maxContacts,
        remaining: Math.max(0, plan.maxContacts - contactCount),
      },
      deals: {
        usage: dealCount,
        limit: plan.maxDeals,
        remaining: Math.max(0, plan.maxDeals - dealCount),
      },
      features: {
        AI_ASSISTANT: plan.aiAssistant,
        EMAIL_SYNC: plan.emailSync,
        AUTOMATION: plan.automation,
        CLIENT_PORTAL: plan.clientPortal,
      },
    };
  }

  async getAvailablePlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async changePlan(organizationId: string, planId: string) {
    const targetPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!targetPlan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    const currentUsage = await this.getUsage(organizationId);

    // Validate if current usage exceeds target plan limits
    if (currentUsage.users.usage > targetPlan.maxUsers) {
      throw new BadRequestException(
        `Cannot change plan: current user count (${currentUsage.users.usage}) exceeds the target plan limit (${targetPlan.maxUsers}).`
      );
    }
    if (currentUsage.contacts.usage > targetPlan.maxContacts) {
      throw new BadRequestException(
        `Cannot change plan: current contact count (${currentUsage.contacts.usage}) exceeds the target plan limit (${targetPlan.maxContacts}).`
      );
    }
    if (currentUsage.deals.usage > targetPlan.maxDeals) {
      throw new BadRequestException(
        `Cannot change plan: current deal count (${currentUsage.deals.usage}) exceeds the target plan limit (${targetPlan.maxDeals}).`
      );
    }

    const sub = await this.getCurrentSubscription(organizationId);

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId,
        updatedAt: new Date(),
      },
      include: { plan: true },
    });
  }
}
