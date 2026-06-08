import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionPlanDto {
  @ApiProperty({ example: 'STARTER' })
  id: string;

  @ApiProperty({ example: 'Starter Plan' })
  name: string;

  @ApiProperty({ example: 'Perfect for small teams getting started', nullable: true })
  description?: string;

  @ApiProperty({ example: 19.00 })
  price: number;

  @ApiProperty({ example: 3 })
  maxUsers: number;

  @ApiProperty({ example: 100 })
  maxContacts: number;

  @ApiProperty({ example: 20 })
  maxDeals: number;

  @ApiProperty({ example: true })
  aiAssistant: boolean;

  @ApiProperty({ example: false })
  emailSync: boolean;

  @ApiProperty({ example: false })
  automation: boolean;

  @ApiProperty({ example: false })
  clientPortal: boolean;
}

export class SubscriptionDto {
  @ApiProperty({ example: 'a0b1c2d3-e4f5-6789-0123-456789abcdef' })
  id: string;

  @ApiProperty({ example: 'org-id-123' })
  organizationId: string;

  @ApiProperty({ example: 'STARTER' })
  planId: string;

  @ApiProperty({ type: SubscriptionPlanDto })
  plan: SubscriptionPlanDto;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-06-05T12:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: null, nullable: true })
  endDate?: Date;

  @ApiProperty({ example: '2026-06-05T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-05T12:00:00.000Z' })
  updatedAt: Date;
}

export class UsageMetricDetailsDto {
  @ApiProperty({ example: 2 })
  usage: number;

  @ApiProperty({ example: 3 })
  limit: number;

  @ApiProperty({ example: 1 })
  remaining: number;
}

export class SubscriptionUsageDto {
  @ApiProperty({ type: UsageMetricDetailsDto })
  users: UsageMetricDetailsDto;

  @ApiProperty({ type: UsageMetricDetailsDto })
  contacts: UsageMetricDetailsDto;

  @ApiProperty({ type: UsageMetricDetailsDto })
  deals: UsageMetricDetailsDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: {
      AI_ASSISTANT: true,
      EMAIL_SYNC: false,
      AUTOMATION: false,
      CLIENT_PORTAL: false,
    },
  })
  features: Record<string, boolean>;
}
