import {
  IsString,
  IsNumber,
  IsMongoId,
  IsPositive,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiProperty({
    type: String,
    description: "Id of the product's category",
    example: '6ab0d52d46ffffded3664c8e',
    required: false,
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiProperty({
    type: String,
    description: 'Name of the product',
    example: 'Whenever bootcut jeans',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    type: String,
    description: 'Slug of the product',
    example: 'whenever-bootcut-jeans',
    required: false,
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({
    type: String,
    description: 'Description of the product',
    example: 'quan gia re mac dep',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: Number,
    description: 'Price of the product',
    example: 1000000,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @ApiProperty({
    type: Number,
    description: 'Stock of the product',
    example: 57,
    required: false,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;
}
