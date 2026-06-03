import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateContactDto {
  @ApiPropertyOptional({ description: 'Optional display name', example: 'Sarah Connor' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Optional unique email address', example: 'sarah@connor.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Optional phone number', example: '+1 (555) 0199' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Optional linked Company UUID', example: 'a0b1c2d3-e4f5-6789-0123-456789abcdef' })
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Optional lifecycle stage status', enum: ['LEAD', 'CONTACTED', 'CUSTOMER', 'CHURNED'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Optional owner User UUID', example: 'f8f9e0d1-c2b3-a495-8678-0123456789ab' })
  @IsUUID('4', { message: 'Owner ID must be a valid UUID' })
  @IsOptional()
  ownerId?: string;
}
