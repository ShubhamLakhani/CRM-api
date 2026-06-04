import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ToggleFeatureDto } from './dto/toggle-feature.dto';

@ApiTags('features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('features')
export class FeaturesController {
  constructor(private readonly featuresService: FeaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all feature flags status for the organization' })
  @ApiResponse({
    status: 200,
    description: 'Map of feature flags and their enabled status',
    schema: {
      type: 'object',
      properties: {
        AI_ASSISTANT: { type: 'boolean', example: true },
        EMAIL_SYNC: { type: 'boolean', example: false },
        AUTOMATION: { type: 'boolean', example: true },
        CUSTOM_FIELDS: { type: 'boolean', example: false },
        CLIENT_PORTAL: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  async getFeatures(@GetUser('organizationId') organizationId: string) {
    return this.featuresService.getFeaturesForOrganization(organizationId);
  }

  @Patch(':featureId')
  @RequirePermissions('billing.manage')
  @ApiOperation({ summary: 'Toggle a feature flag status for the organization' })
  @ApiResponse({
    status: 200,
    description: 'Feature flag updated successfully',
    schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4' },
        featureId: { type: 'string', example: 'AI_ASSISTANT' },
        isEnabled: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  @ApiResponse({ status: 403, description: 'User lacks billing.manage permissions.' })
  async toggleFeature(
    @Param('featureId') featureId: string,
    @Body() toggleFeatureDto: ToggleFeatureDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    const { isEnabled } = toggleFeatureDto;
    return this.featuresService.updateFeatureFlag(organizationId, featureId, isEnabled);
  }
}
