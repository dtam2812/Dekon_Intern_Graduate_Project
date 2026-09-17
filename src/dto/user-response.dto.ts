import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { UserRole } from 'src/enum/userRole.enum';

export class UserResponseDto {
  @IsString()
  @IsNotEmpty({ message: 'Name must be filled' })
  @MaxLength(50, { message: 'Name must be less than 50 characters' })
  @MinLength(6, { message: 'Name must be at least 6 characters' })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Email must be filled' })
  @MaxLength(50, { message: 'Email must be less than 50 characters' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email!: string;

  @IsEnum(UserRole)
  role?: UserRole;

  @IsEnum(AuthProvider)
  provider?: AuthProvider;
}
