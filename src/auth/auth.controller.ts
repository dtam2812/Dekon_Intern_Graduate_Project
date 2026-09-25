import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LogInUserDto } from 'src/dto/logIn-user.dto';
import { RefreshTokenDto } from 'src/dto/refresh-token.dto';
import { RegisterDto } from 'src/dto/register.dto';
import { AuthGuard } from '@nestjs/passport';
import { Public } from 'src/decorator/public.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  logIn(
    @Body() dto: LogInUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.logIn(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req: any) {
    return this.authService.googleLogin(req.user);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('google/confirm-link')
  async confirmLinkGoogleAccount(
    @Body() dto: { pendingLinkToken: string; password: string },
  ) {
    return this.authService.confirmLinkGoogleAccount(
      dto.pendingLinkToken,
      dto.password,
    );
  }
}
