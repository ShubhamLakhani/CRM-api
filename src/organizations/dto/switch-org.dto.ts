import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchOrgDto {
  @ApiProperty({
    description: 'The target organization UUID to switch active context to',
    example: '86d5335b-4107-4co8-b1bc-dd07c5d7ddb4',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  organizationId: string;
}
