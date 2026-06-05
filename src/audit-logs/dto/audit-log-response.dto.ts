import { ApiProperty } from '@nestjs/swagger';

export class AuditLogActorDto {
  @ApiProperty({ description: 'The unique ID of the actor', example: 'd3b07384-d113-4956-a5cc-98a0028a7e08' })
  id: string;

  @ApiProperty({ description: 'The name of the actor', example: 'Sarah Connor' })
  name: string;

  @ApiProperty({ description: 'The email address of the actor', example: 'demo@apex.com' })
  email: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ description: 'The unique ID of the audit log', example: '3e25b163-95b8-444f-a9cb-f14d8ff21ab1' })
  id: string;

  @ApiProperty({ description: 'The action performed', example: 'CREATE' })
  action: string;

  @ApiProperty({ description: 'The affected entity type', example: 'COMPANY' })
  entityType: string;

  @ApiProperty({ description: 'The ID of the affected entity', example: 'bca7431e-450f-482a-886f-23a5951d6c8b', nullable: true })
  entityId: string | null;

  @ApiProperty({ description: 'The state of the entity before the action', example: null, nullable: true })
  before: any;

  @ApiProperty({ description: 'The state of the entity after the action', example: { name: 'Tesla, Inc.', domain: 'tesla.com' }, nullable: true })
  after: any;

  @ApiProperty({ description: 'The IP address from which the action was initiated', example: '127.0.0.1', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ description: 'The date and time when the action occurred', example: '2026-06-05T01:34:09.000Z' })
  createdAt: Date;

  @ApiProperty({ description: 'The user ID of the actor', example: 'd3b07384-d113-4956-a5cc-98a0028a7e08', nullable: true })
  userId: string | null;

  @ApiProperty({ description: 'The actor details', type: () => AuditLogActorDto, nullable: true })
  user: AuditLogActorDto | null;

  @ApiProperty({ description: 'The organization ID where the action took place', example: 'c0b89b4e-2895-4674-8b61-71fb342416f4' })
  organizationId: string;
}

export class AuditLogsMetaDto {
  @ApiProperty({ description: 'Total number of records matching search and filters', example: 120 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of records per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 12 })
  totalPages: number;
}

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({ description: 'List of audit logs', type: [AuditLogResponseDto] })
  data: AuditLogResponseDto[];

  @ApiProperty({ description: 'Pagination metadata', type: AuditLogsMetaDto })
  meta: AuditLogsMetaDto;
}
