import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({
    description: 'The cryptographically secure token from the invitation link',
    example: 'a4b2c8e3...',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
