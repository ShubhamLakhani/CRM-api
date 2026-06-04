import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleFeatureDto {
  @ApiProperty({
    description: 'The toggle status for the feature (true for enabled, false for disabled)',
    example: true,
    required: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  isEnabled: boolean;
}
