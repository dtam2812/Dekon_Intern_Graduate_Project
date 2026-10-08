import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    type: String,
    description: 'Full name of the user',
    example: 'Dinh Nguyen Duc Tam',
    minLength: 6,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Name must be filled' })
  @MaxLength(50, { message: 'Name must be less than 50 characters' })
  @MinLength(6, { message: 'Name must be at least 6 characters' })
  fullName!: string;

  @ApiProperty({
    type: String,
    description: 'Email used to register. Must be unique',
    example: 'nguyenductam@example.com',
    format: 'email',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Email must be filled' })
  @MaxLength(50, { message: 'Email must be less than 50 characters' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email!: string;

  @ApiProperty({
    type: String,
    description: 'Password',
    example: 'nguyen12345',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password?: string;
}
