import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';

export class FilterProductDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  itemsPerPage?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;
}
