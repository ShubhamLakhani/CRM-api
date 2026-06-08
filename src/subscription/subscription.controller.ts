import { Controller, Get, Post, Body, UseGuards, BadRequestException, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { SubscriptionService } from './subscription.service';
import { ChangePlanDto } from './dto/change-plan.dto';
import { SubscriptionDto, SubscriptionPlanDto, SubscriptionUsageDto } from './dto/subscription.dto';

@ApiTags('Subscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  private checkOrganizationId(organizationId?: string): string {
    if (!organizationId) {
      throw new BadRequestException('Active organization workspace is required');
    }
    return organizationId;
  }

  @Get('current')
  @ApiOperation({
    summary: 'Get current subscription details',
    description: "Retrieves active subscription details for the user's current organization.",
  })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Missing organization ID' })
  getCurrent(@GetUser('organizationId') organizationId?: string) {
    const orgId = this.checkOrganizationId(organizationId);
    return this.subscriptionService.getCurrentSubscription(orgId);
  }

  @Get('usage')
  @ApiOperation({
    summary: 'Get current subscription usage',
    description: 'Retrieves quota usage details (Users, Contacts, Deals) for the current organization.',
  })
  @ApiResponse({ status: 200, type: SubscriptionUsageDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Missing organization ID' })
  getUsage(@GetUser('organizationId') organizationId?: string) {
    const orgId = this.checkOrganizationId(organizationId);
    return this.subscriptionService.getUsage(orgId);
  }

  @Get('plans')
  @ApiOperation({
    summary: 'Get all available subscription plans',
    description: 'Retrieves all available subscription plans in the catalog.',
  })
  @ApiResponse({ status: 200, type: [SubscriptionPlanDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getPlans() {
    return this.subscriptionService.getAvailablePlans();
  }

  @Post('change-plan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change subscription plan',
    description: "Upgrades or downgrades the current organization's subscription plan.",
  })
  @ApiResponse({ status: 200, type: SubscriptionDto })
  @ApiResponse({ status: 400, description: 'Invalid plan or usage limits exceeded target plan quotas' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  changePlan(
    @Body() changePlanDto: ChangePlanDto,
    @GetUser('organizationId') organizationId?: string,
  ) {
    const orgId = this.checkOrganizationId(organizationId);
    return this.subscriptionService.changePlan(orgId, changePlanDto.planId);
  }
}
