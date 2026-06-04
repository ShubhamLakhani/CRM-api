import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDealNoteDto {
  @ApiProperty({
    description: 'The content description of the note to attach to the deal',
    example: 'Discussed pricing; client is positive about the proposal.',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  description: string;
}
