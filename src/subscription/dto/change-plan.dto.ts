import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({
    description: 'The ID of the target subscription plan',
    example: 'STARTER',
    enum: ['FREE', 'STARTER', 'GROWTH', 'AGENCY'],
  })
  @IsString()
  @IsNotEmpty({ message: 'Plan ID is required' })
  @IsIn(['FREE', 'STARTER', 'GROWTH', 'AGENCY'], {
    message: 'Plan ID must be one of FREE, STARTER, GROWTH, AGENCY',
  })
  planId: string;
}
