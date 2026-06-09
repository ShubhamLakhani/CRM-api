import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationExecutionStatus } from '@prisma/client';

export class ExecutionsQueryDto {
  @ApiPropertyOptional({ description: 'Filter executions by automation rule ID' })
  @IsString()
  @IsOptional()
  ruleId?: string;

  @ApiPropertyOptional({ description: 'Filter executions by status', enum: AutomationExecutionStatus })
  @IsEnum(AutomationExecutionStatus)
  @IsOptional()
  status?: AutomationExecutionStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page limit', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
