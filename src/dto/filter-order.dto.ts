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

export class FilterOrderDto {
  @ApiPropertyOptional({
    description: 'Order offset-based pagination',
    example: '2',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Amount of order per page',
    example: '5',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  itemsPerPage?: number = 10;

  @ApiPropertyOptional({
    description: "Filter order by user's name",
    example: 'tam',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter order by user id',
    example: '6abf147c7dd0e0f4170a013b',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;
}
