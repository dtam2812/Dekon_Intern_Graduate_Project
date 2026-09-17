import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from 'src/enum/userRole.enum';

export class UpdateUserDto {
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
  @IsString()
  @IsNotEmpty({ message: 'Password must be filled' })
  @MaxLength(50, { message: 'Password must be less than 50 characters' })
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
