import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: 'The name of the company', example: 'Stark Industries' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'The website domain of the company', example: 'starkindustries.com' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ description: 'The industry sector of the company', example: 'Aerospace & Defense' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({ description: 'The total number of employees', example: 4500 })
  @IsNumber()
  @IsOptional()
  employees?: number;
}
