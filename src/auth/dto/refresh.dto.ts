import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Target organization ID to refresh the context into',
    example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4',
    required: false,
  })
  @IsOptional()
  @IsString()
  organizationId?: string;
}
