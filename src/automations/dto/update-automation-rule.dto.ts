import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsEnum, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AutomationTrigger } from '@prisma/client';
import { CreateAutomationActionDto } from './create-automation-rule.dto';
import { IsAutomationConditions } from './conditions.validator';

export class UpdateAutomationRuleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: AutomationTrigger })
  @IsEnum(AutomationTrigger)
  @IsOptional()
  triggerEvent?: AutomationTrigger;

  @ApiPropertyOptional()
  @IsOptional()
  @IsAutomationConditions()
  conditionsJson?: any;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ type: [CreateAutomationActionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateAutomationActionDto)
  actions?: CreateAutomationActionDto[];
}
