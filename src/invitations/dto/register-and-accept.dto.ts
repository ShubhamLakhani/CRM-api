import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterAndAcceptDto {
  @ApiProperty({
    description: 'The cryptographically secure token from the invitation link',
    example: 'a4b2c8e3...',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    description: 'The display name of the new user',
    example: 'Jane Doe',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Password for the new user account (min length 6)',
    example: 'password123',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
