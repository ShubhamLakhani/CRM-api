import { Injectable } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class PlanEntitlementService {
  constructor(private subscriptionService: SubscriptionService) {}

  async canInviteUser(organizationId: string): Promise<boolean> {
    const usage = await this.subscriptionService.getUsage(organizationId);
    return usage.users.usage < usage.users.limit;
  }

  async canCreateContact(organizationId: string): Promise<boolean> {
    const usage = await this.subscriptionService.getUsage(organizationId);
    return usage.contacts.usage < usage.contacts.limit;
  }

  async canCreateDeal(organizationId: string): Promise<boolean> {
    const usage = await this.subscriptionService.getUsage(organizationId);
    return usage.deals.usage < usage.deals.limit;
  }

  async canUseFeature(organizationId: string, featureKey: string): Promise<boolean> {
    const sub = await this.subscriptionService.getCurrentSubscription(organizationId);
    const plan = sub.plan;

    switch (featureKey.toUpperCase()) {
      case 'AI_ASSISTANT':
        return plan.aiAssistant;
      case 'EMAIL_SYNC':
        return plan.emailSync;
      case 'AUTOMATION':
        return plan.automation;
      case 'CLIENT_PORTAL':
        return plan.clientPortal;
      default:
        return false;
    }
  }

  async getRemainingQuota(organizationId: string): Promise<{ users: number; contacts: number; deals: number }> {
    const usage = await this.subscriptionService.getUsage(organizationId);
    return {
      users: usage.users.remaining,
      contacts: usage.contacts.remaining,
      deals: usage.deals.remaining,
    };
  }
}
