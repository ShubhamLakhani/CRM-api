import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AutomationsService } from './automations.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { ExecutionsQueryDto } from './dto/executions-query.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Post()
  @RequirePermissions('automations.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new automation rule', description: 'Creates an automation rule with configuration actions scoped to the organization.' })
  @ApiResponse({ status: 201, description: 'Automation rule successfully created.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 403, description: 'Forbidden resource - insufficient permissions.' })
  create(
    @Body() createDto: CreateAutomationRuleDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.create(createDto, userId, organizationId);
  }

  @Get()
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all automation rules', description: 'Retrieves all automation rules for the active organization.' })
  @ApiResponse({ status: 200, description: 'List of rules retrieved successfully.' })
  findAll(@GetUser('organizationId') organizationId: string) {
    return this.automationsService.findAll(organizationId);
  }

  @Get('metadata')
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get automation rules trigger/field/action metadata schemas', description: 'Returns metadata schema definitions for rule construction in the UI.' })
  @ApiResponse({ status: 200, description: 'Metadata returned successfully.' })
  getMetadata(@GetUser('organizationId') organizationId: string) {
    return this.automationsService.getMetadata(organizationId);
  }

  @Get('templates')
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all available automation templates' })
  @ApiResponse({ status: 200, description: 'Templates list retrieved successfully.' })
  getTemplates() {
    return this.automationsService.getTemplates();
  }

  @Get('templates/:id')
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single automation template definition' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  getTemplateById(@Param('id') id: string) {
    return this.automationsService.getTemplateById(id);
  }

  @Post('templates/:id/instantiate')
  @RequirePermissions('automations.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Instantiate an automation rule from a template' })
  @ApiResponse({ status: 201, description: 'Rule successfully instantiated.' })
  @ApiResponse({ status: 400, description: 'Validation or recipient check failed.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  instantiate(
    @Param('id') id: string,
    @Body() instantiateDto: InstantiateTemplateDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.instantiateTemplate(id, instantiateDto, userId, organizationId);
  }

  @Get('executions')
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List and paginate execution history', description: 'Retrieves automation executions scoped to the tenant with optional status and rule filters.' })
  @ApiResponse({ status: 200, description: 'Paginated executions list returned successfully.' })
  findExecutions(
    @Query() query: ExecutionsQueryDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.findExecutions(query, organizationId);
  }

  @Get('stats')
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get execution statistics', description: 'Retrieves aggregated execution counts and success rate for the tenant or a specific rule.' })
  @ApiResponse({ status: 200, description: 'Statistics returned successfully.' })
  getStats(
    @Query('ruleId') ruleId: string | undefined,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.getStats(ruleId, organizationId);
  }

  @Get(':id')
  @RequirePermissions('automations.view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get an automation rule by ID', description: 'Retrieves details for a specific automation rule in the organization.' })
  @ApiResponse({ status: 200, description: 'Rule details retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Rule not found.' })
  findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @RequirePermissions('automations.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an automation rule', description: 'Updates rule properties, conditions, actions, and increments version count.' })
  @ApiResponse({ status: 200, description: 'Rule successfully updated.' })
  @ApiResponse({ status: 404, description: 'Rule not found.' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAutomationRuleDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.update(id, updateDto, userId, organizationId);
  }

  @Delete(':id')
  @RequirePermissions('automations.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an automation rule', description: 'Permanently removes an automation rule and prunes actions.' })
  @ApiResponse({ status: 200, description: 'Rule successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Rule not found.' })
  remove(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.automationsService.remove(id, userId, organizationId);
  }
}
