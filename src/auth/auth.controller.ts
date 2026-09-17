import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LogInUserDto } from 'src/dto/logIn-user.dto';
import { RefreshTokenDto } from 'src/dto/refresh-token.dto';
import { RegisterDto } from 'src/dto/register.dto';
import { Public } from 'src/metadata/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  logIn(
    @Body() dto: LogInUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.logIn(dto);
  }

  @Post('refresh')
  refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  logOut(@Body() dto: RefreshTokenDto) {
    return this.authService.logOut(dto);
  }

  @Get('profile')
  getProfile(@Req() req: any) {
    return req.user;
  }
}
