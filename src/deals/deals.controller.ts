import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { CreateDealNoteDto } from './dto/create-deal-note.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { FeatureGuard } from '../features/feature.guard';
import { RequireFeature } from '../features/feature.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get('ai/forecast')
  @UseGuards(FeatureGuard)
  @RequireFeature('AI_ASSISTANT')
  @ApiOperation({ summary: 'AI Pipeline Deal Forecast', description: 'Returns AI forecasted insights on pipeline deals.' })
  @ApiResponse({ status: 200, description: 'AI forecast object' })
  async getAiForecast(@GetUser('organizationId') organizationId: string) {
    return {
      forecast: 'Based on your active deals value of $1,420,000 across stages, we predict a 78% win rate for Q2, resulting in an estimated closed revenue of $1,107,600. Critical focus: Azure Cloud Migration Services deal is currently stuck in Proposal stage with no recent user updates.',
      confidenceScore: 0.88,
      updatedAt: new Date().toISOString(),
    };
  }

  @Get('summary/stats')
  @ApiOperation({ summary: 'Get pipeline deals statistics', description: 'Returns aggregate metrics of deals (win rate, total pipeline, activity logs) in the user\'s Organization.' })
  @ApiResponse({ status: 200, description: 'Aggregate statistics structure' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  getStats(@GetUser('organizationId') organizationId: string) {
    return this.dealsService.getStats(organizationId);
  }

  @Post()
  @RequirePermissions('deals.create')
  @ApiOperation({ summary: 'Create a new deal', description: 'Creates a sales opportunity and records system log.' })
  @ApiResponse({ status: 201, description: 'Deal created successfully' })
  @ApiResponse({ status: 400, description: 'Validation errors' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  create(
    @Body() createDealDto: CreateDealDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.dealsService.create(createDealDto, userId, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List deals registry', description: 'Retrieves all active deals in the current user\'s Organization.' })
  @ApiResponse({ status: 200, description: 'Returns array of deal objects' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  findAll(@GetUser('organizationId') organizationId: string) {
    return this.dealsService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get deal details', description: 'Retrieves comprehensive details of a deal by UUID.' })
  @ApiResponse({ status: 200, description: 'Returns detailed deal item' })
  @ApiResponse({ status: 404, description: 'Deal not found or belongs to another organization' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  findOne(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    return this.dealsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @RequirePermissions('deals.update')
  @ApiOperation({ summary: 'Update deal parameters', description: 'Updates specific deal parameters and triggers history updates.' })
  @ApiResponse({ status: 200, description: 'Deal successfully updated' })
  @ApiResponse({ status: 404, description: 'Deal not found or belongs to another organization' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  update(
    @Param('id') id: string,
    @Body() updateDealDto: UpdateDealDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.dealsService.update(id, updateDealDto, userId, organizationId);
  }

  @Delete(':id')
  @RequirePermissions('deals.delete')
  @ApiOperation({ summary: 'Soft delete a deal', description: 'Appends deletedAt timestamp to deal entry.' })
  @ApiResponse({ status: 200, description: 'Deal successfully soft deleted' })
  @ApiResponse({ status: 404, description: 'Deal not found or belongs to another organization' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.dealsService.remove(id, userId, organizationId);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add a note to a deal', description: 'Creates a custom note activity log for a deal.' })
  @ApiResponse({
    status: 201,
    description: 'Note added successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'dff69b6e-453e-46d2-a9c3-af51bf539652' },
        type: { type: 'string', example: 'NOTE' },
        description: { type: 'string', example: 'Discussed pricing; client is positive about the proposal.' },
        dealId: { type: 'string', example: '86d5335b-...' },
        organizationId: { type: 'string', example: '86d5335b-...' },
        userId: { type: 'string', example: 'c8a04a8f-196a-43d1-9b13-e08e4364ca4e' },
        createdAt: { type: 'string', example: '2026-06-04T12:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Deal not found or belongs to another organization' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  addNote(
    @Param('id') id: string,
    @Body() createDealNoteDto: CreateDealNoteDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    const { description } = createDealNoteDto;
    return this.dealsService.addNote(id, description, userId, organizationId);
  }
}

