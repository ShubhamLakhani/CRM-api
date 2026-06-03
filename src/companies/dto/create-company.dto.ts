import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'The name of the company', example: 'Stark Industries' })
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  name: string;

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

  @ApiPropertyOptional({ description: 'An initial pipeline deal valuation to create a linked deal', example: 340000 })
  @IsNumber()
  @IsOptional()
  dealValue?: number;
}
