import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    type: String,
    description: 'Name of the category',
    example: 'Bootcut jeans',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    type: String,
    description: 'Slug of the category',
    example: 'bootcut-jeans',
  })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
