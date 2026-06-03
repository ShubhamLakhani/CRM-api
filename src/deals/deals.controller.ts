import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get('summary/stats')
  @ApiOperation({ summary: 'Get pipeline deals statistics', description: 'Returns aggregate metrics of deals (win rate, total pipeline, activity logs) in the user\'s Organization.' })
  @ApiResponse({ status: 200, description: 'Aggregate statistics structure' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  getStats(@GetUser('organizationId') organizationId: string) {
    return this.dealsService.getStats(organizationId);
  }

  @Post()
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
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  @ApiResponse({ status: 404, description: 'Deal not found or belongs to another organization' })
  @ApiResponse({ status: 401, description: 'Missing or expired JWT session token.' })
  addNote(
    @Param('id') id: string,
    @Body('description') description: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.dealsService.addNote(id, description, userId, organizationId);
  }
}

