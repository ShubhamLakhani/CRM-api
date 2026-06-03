import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TasksQueryDto {
  @ApiPropertyOptional({ description: 'Search term for matching task titles' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter tasks by status' })
  @IsString()
  @IsOptional()
  status?: string;
}
