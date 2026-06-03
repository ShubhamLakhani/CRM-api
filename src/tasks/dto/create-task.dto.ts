import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ description: 'The title/summary of the task', example: 'Conduct discovery call with Tesla Solar engineering leads' })
  @IsString()
  @IsNotEmpty({ message: 'Task title is required' })
  title: string;

  @ApiPropertyOptional({ description: 'The detailed description of the task' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'The task status', enum: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'], default: 'TODO' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'The task priority level', enum: ['HIGH', 'MEDIUM', 'LOW', 'NONE'], default: 'MEDIUM' })
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ description: 'The due date for task completion', example: '2026-06-04T12:00:00Z' })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'The UUID of the linked deal opportunity' })
  @IsUUID(undefined, { message: 'Invalid deal UUID' })
  @IsOptional()
  dealId?: string;

  @ApiPropertyOptional({ description: 'The UUID of the assignee user account' })
  @IsUUID(undefined, { message: 'Invalid assignee user UUID' })
  @IsOptional()
  assigneeId?: string;
}
