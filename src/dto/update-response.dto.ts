import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from 'src/enum/userRole.enum';

export class UpdateResponseDto {
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Name must be at least 6 characters' })
  @MaxLength(50, { message: 'Name must be less than 50 characters' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @MaxLength(50, { message: 'Email must be less than 50 characters' })
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
