import { Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiParam } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get organization activities',
    description: 'Retrieves a paginated list of activities for the current organization.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of activities per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search term' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by entity type (contact, company, deal, task, user)' })
  @ApiResponse({ status: 200, description: 'Returns list of activities.' })
  findAll(
    @GetUser('organizationId') organizationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    const query: any = {};
    if (page !== undefined) query.page = Number(page);
    if (limit !== undefined) query.limit = Number(limit);
    if (search !== undefined) query.search = search;
    if (type !== undefined) query.type = type;
    return this.activityService.getActivities(organizationId, query);
  }

  @Get('entity/:entityType/:entityId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get activities by entity',
    description: 'Retrieves a paginated list of activities for a specific entity in the organization.',
  })
  @ApiParam({ name: 'entityType', required: true, type: String, description: 'The entity type (e.g. contact, company, deal, task, user)' })
  @ApiParam({ name: 'entityId', required: true, type: String, description: 'The entity UUID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of activities per page' })
  @ApiResponse({ status: 200, description: 'Returns list of activities for the specified entity.' })
  findByEntity(
    @GetUser('organizationId') organizationId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityService.getActivitiesByEntity(organizationId, entityType, entityId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
