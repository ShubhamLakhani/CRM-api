import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateInviteDto {
  @ApiProperty({
    description: 'The invitation token to validate',
    example: 'a4b2c8e3...',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
