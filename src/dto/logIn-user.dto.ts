import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LogInUserDto {
  @ApiProperty({
    type: String,
    description: 'Email used to log in',
    example: 'admin@dekon.com',
    format: 'email',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty({ message: 'Email must be filled' })
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email!: string;

  @ApiProperty({
    type: String,
    format: 'password',
    description: 'Password',
    example: 'Admin@123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password must be filled' })
  password!: string;
}
