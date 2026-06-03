import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'The title/summary of the task' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'The detailed description of the task' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'The task status', enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'The task priority level', enum: ['HIGH', 'MEDIUM', 'LOW', 'NONE'] })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ description: 'The due date for task completion' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'The UUID of the linked deal opportunity' })
  @IsUUID()
  @IsOptional()
  dealId?: string;

  @ApiPropertyOptional({ description: 'The UUID of the assignee user account' })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;
}
