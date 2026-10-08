import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class FilterProductDto {
  @ApiPropertyOptional({
    description: 'Product offset-based pagination',
    example: '2',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Amount of item per page',
    example: '5',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  itemsPerPage?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter product by name',
    example: 'bootcut',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter product by category id',
    example: '6ab0d52d46ffffded3664c8e',
  })
  @IsOptional()
  @IsMongoId()
  categoryId?: string;
}
