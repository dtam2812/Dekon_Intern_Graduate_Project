import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsMongoId,
  IsPositive,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateProductDto {
  @IsMongoId()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @Transform(
    ({ value }) =>
      typeof value === 'string' && value.trim() === '' ? NaN : Number(value),
    { toClassOnly: true },
  )
  @IsNumber()
  @IsPositive()
  price!: number;

  @Transform(
    ({ value }) =>
      typeof value === 'string' && value.trim() === '' ? NaN : Number(value),
    { toClassOnly: true },
  )
  @IsNumber()
  @Min(0)
  stock!: number;
}
