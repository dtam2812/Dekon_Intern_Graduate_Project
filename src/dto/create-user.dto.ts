import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { UserRole } from 'src/enum/userRole.enum';

export class CreateUserDto {
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

  @ValidateIf((dto: CreateUserDto) => dto.provider === AuthProvider.LOCAL)
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsEnum(AuthProvider)
  @IsNotEmpty()
  provider!: AuthProvider;
}
