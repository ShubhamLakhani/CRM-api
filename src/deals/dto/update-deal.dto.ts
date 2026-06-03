import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateDealDto {
  @ApiPropertyOptional({ description: 'The title/name of the deal', example: 'Acme Corp Contract Renewal' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'The financial value of the deal', example: 50000 })
  @IsNumber()
  @IsOptional()
  value?: number;

  @ApiPropertyOptional({ description: 'The current sales pipeline stage', enum: ['LEAD', 'CONTACTED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] })
  @IsString()
  @IsOptional()
  stage?: string; // LEAD, CONTACTED, PROPOSAL, NEGOTIATION, WON, LOST

  @ApiPropertyOptional({ description: 'The associated contact UUID', example: 'a0b1c2d3-e4f5-6789-0123-456789abcdef' })
  @IsString()
  @IsOptional()
  contactId?: string;
}

