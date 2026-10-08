import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Full name of the user',
    example: 'Dinh Nguyen Duc Tam',
    minLength: 6,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Name must be at least 6 characters' })
  @MaxLength(50, { message: 'Name must be less than 50 characters' })
  fullName?: string;

  @ApiPropertyOptional({
    description:
      'New email. Must be unique. Not allowed for Google-linked accounts. Requires currentPassword',
    example: 'nguyenductam@example.com',
    format: 'email',
    maxLength: 50,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(50, { message: 'Email must be less than 50 characters' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Current password. Required when changing password or email',
    example: 'nguyen12345',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Current password must be filled' })
  @MinLength(6, { message: 'Current password must be at least 6 characters' })
  currentPassword?: string;

  @ApiPropertyOptional({
    description: 'New password',
    example: 'nguyen67890',
    minLength: 6,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Password must be filled' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword?: string;
}
