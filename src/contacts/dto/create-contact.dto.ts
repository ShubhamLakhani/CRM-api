import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'The full display name of the contact', example: 'Sarah Connor' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({ description: 'Unique email address of the contact', example: 'sarah@connor.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiPropertyOptional({ description: 'Optional phone number', example: '+1 (555) 0199' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Optional linked Company UUID', example: 'a0b1c2d3-e4f5-6789-0123-456789abcdef' })
  @IsUUID('4', { message: 'Company ID must be a valid UUID' })
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Optional lifecycle stage status', enum: ['LEAD', 'CONTACTED', 'CUSTOMER', 'CHURNED'], default: 'LEAD' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Optional owner User UUID (defaults to creator)', example: 'f8f9e0d1-c2b3-a495-8678-0123456789ab' })
  @IsUUID('4', { message: 'Owner ID must be a valid UUID' })
  @IsOptional()
  ownerId?: string;
}
