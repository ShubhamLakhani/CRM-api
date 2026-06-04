import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateInviteDto {
  @ApiProperty({
    description: 'The email address of the user being invited',
    example: 'operator@company.com',
    required: true,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The role identifier to assign upon acceptance (e.g., OWNER, ADMIN, MANAGER, SALES, SUPPORT, VIEWER)',
    example: 'MANAGER',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  roleId: string;
}
