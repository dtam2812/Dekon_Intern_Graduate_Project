import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LogInUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Email must be filled' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password must be filled' })
  password!: string;
}
