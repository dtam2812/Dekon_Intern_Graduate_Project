import {
  IsString,
  IsNumber,
  IsMongoId,
  IsArray,
  ArrayNotEmpty,
  IsPositive,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductDto {
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  images?: string[];
}
