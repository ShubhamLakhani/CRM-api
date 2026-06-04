import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Filter only unread notifications', type: Boolean, default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number for pagination', type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: 'Number of notifications per page', type: Number, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class NotificationDto {
  @ApiProperty({ description: 'The unique identifier of the notification', example: 'd3b07384-d113-4ec2-a5d6-c74b88b7f7e8' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'The title of the notification', example: 'New Task Assigned' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'The message body of the notification', example: 'You have been assigned to task: "Complete review"' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'The notification transport type', example: 'IN_APP', default: 'IN_APP' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'The event action code triggering the notification', example: 'TASK_ASSIGNED' })
  @IsString()
  event: string;

  @ApiPropertyOptional({ description: 'The reference entity model name for deep-linking', example: 'task', nullable: true })
  @IsOptional()
  @IsString()
  entityType?: string | null;

  @ApiPropertyOptional({ description: 'The reference entity ID for deep-linking', example: '4e7b8c2a-1123-4567-89ab-cdef01234567', nullable: true })
  @IsOptional()
  @IsString()
  entityId?: string | null;

  @ApiPropertyOptional({ description: 'Timestamp when the notification was read', example: '2026-06-05T00:00:00.000Z', nullable: true })
  @IsOptional()
  readAt?: Date | null;

  @ApiProperty({ description: 'Timestamp when the notification was created', example: '2026-06-05T00:00:00.000Z' })
  createdAt: Date;
}

export class PaginatedNotificationsDto {
  @ApiProperty({ type: [NotificationDto], description: 'List of notifications' })
  data: NotificationDto[];

  @ApiProperty({ description: 'Total count of notifications', example: 100 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages available', example: 10 })
  totalPages: number;
}

export class UnreadCountDto {
  @ApiProperty({ description: 'The number of unread notifications', example: 5 })
  @IsNumber()
  count: number;
}

export class MarkAllReadResponseDto {
  @ApiProperty({ description: 'Number of notifications updated', example: 10 })
  @IsNumber()
  count: number;
}
