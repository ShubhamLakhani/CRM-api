import { Controller, Get, Param, Query, UseGuards, Res, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { GetUser } from '../auth/get-user.decorator';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';
import { PaginatedAuditLogsResponseDto, AuditLogResponseDto } from './dto/audit-log-response.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('audit.view')
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List organization audit logs',
    description: 'Retrieves a paginated list of system-wide audit logs matching search terms and filters in the active organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved list of audit logs.',
    type: PaginatedAuditLogsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires audit.view permission.' })
  async findAll(
    @Query() queryDto: AuditLogsQueryDto,
    @GetUser('organizationId') organizationId: string,
  ): Promise<PaginatedAuditLogsResponseDto> {
    return this.auditLogsService.findAll(queryDto, organizationId);
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export audit logs as CSV',
    description: 'Generates and downloads a CSV spreadsheet of audit logs matching search and filters (ignoring pagination limits) in the active organization.',
  })
  @ApiResponse({
    status: 200,
    description: 'A CSV file containing the matched audit logs.',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires audit.view permission.' })
  async export(
    @Query() queryDto: AuditLogsQueryDto,
    @GetUser('organizationId') organizationId: string,
    @Res() res: express.Response,
  ): Promise<void> {
    // Exclude pagination params from query
    const { page, limit, ...filterQuery } = queryDto;
    const csvContent = await this.auditLogsService.exportCsv(filterQuery, organizationId);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
    res.status(HttpStatus.OK).send(csvContent);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get audit log details',
    description: 'Retrieves the detailed record of a specific audit log by its UUID, including state changes (before/after).',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved audit log detail.',
    type: AuditLogResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized request.' })
  @ApiResponse({ status: 403, description: 'Forbidden - requires audit.view permission.' })
  @ApiResponse({ status: 404, description: 'Audit log not found.' })
  async findOne(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<AuditLogResponseDto> {
    return this.auditLogsService.findOne(id, organizationId);
  }
}
