import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationTrigger, AutomationActionType } from '@prisma/client';

export class ActionConfigDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dueDateOffsetDays?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  body?: string;
}

export class CreateAutomationActionDto {
  @ApiProperty({ enum: AutomationActionType })
  @IsEnum(AutomationActionType)
  actionType: AutomationActionType;

  @ApiProperty()
  @ValidateNested()
  @Type(() => ActionConfigDto)
  configurationJson: ActionConfigDto;
}

export class CreateAutomationRuleDto {
  @ApiProperty({ example: 'Assign task' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AutomationTrigger })
  @IsEnum(AutomationTrigger)
  triggerEvent: AutomationTrigger;

  @ApiPropertyOptional()
  @IsOptional()
  conditionsJson?: any;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiProperty({ type: [CreateAutomationActionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAutomationActionDto)
  actions: CreateAutomationActionDto[];
}
