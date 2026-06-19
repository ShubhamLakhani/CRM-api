import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAutomationActionDto } from './create-automation-rule.dto';

export class InstantiateTemplateDto {
  @ApiPropertyOptional({ example: 'My Custom Lead Follow Up' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Auto-assign tasks for newly created leads' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ type: [CreateAutomationActionDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateAutomationActionDto)
  actions?: CreateAutomationActionDto[];
}
