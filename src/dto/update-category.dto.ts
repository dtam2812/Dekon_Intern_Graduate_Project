import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateCategoryDto {
  @ApiProperty({
    type: String,
    description: 'Name of the category',
    example: 'Bootcut jeans',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: String,
    description: 'Slug of the category',
    example: 'bootcut-jeans',
    required: false,
  })
  @IsOptional()
  @IsString()
  slug?: string;
}
