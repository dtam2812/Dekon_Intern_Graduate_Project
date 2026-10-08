import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsMongoId,
  IsPositive,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    type: String,
    description: "Id of the product's category",
    example: '6ab0d52d46ffffded3664c8e',
  })
  @IsMongoId()
  categoryId!: string;

  @ApiProperty({
    type: String,
    description: 'Name of the product',
    example: 'Whenever bootcut jeans',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    type: String,
    description: 'Slug of the product',
    example: 'whenever-bootcut-jeans',
  })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({
    type: String,
    description: 'Description of the product',
    example: 'quan gia re mac dep',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    type: Number,
    description: 'Price of the product',
    example: 1000000,
  })
  @Transform(
    ({ value }) =>
      typeof value === 'string' && value.trim() === '' ? NaN : Number(value),
    { toClassOnly: true },
  )
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiProperty({
    type: Number,
    description: 'Stock of the product',
    example: 57,
  })
  @Transform(
    ({ value }) =>
      typeof value === 'string' && value.trim() === '' ? NaN : Number(value),
    { toClassOnly: true },
  )
  @IsNumber()
  @Min(0)
  stock!: number;
}
