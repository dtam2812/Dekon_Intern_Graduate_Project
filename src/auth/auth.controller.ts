import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LogInUserDto } from 'src/dto/logIn-user.dto';
import { RefreshTokenDto } from 'src/dto/refresh-token.dto';
import { RegisterDto } from 'src/dto/register.dto';
import { AuthGuard } from '@nestjs/passport';
import { Public } from 'src/decorator/public.decorator';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ConfirmLinkGoogleDto } from 'src/dto/confirm-link-google.dto';
import { TokenResponseDto } from 'src/dto/token-response.dto';
import {
  ApiCreatedData,
  ApiOkData,
  ApiOkOneOfData,
} from 'src/decorator/api-data-response.decorator';
import { MessageResponseDto } from 'src/dto/message-response.dto';
import { ProfileResponseDto } from 'src/dto/profile-response.dto';
import { LinkConfirmationResponseDto } from 'src/dto/confirm-link-google-response.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Registers a new user with email and password. Assigns CUSTOMER role and LOCAL provider.',
  })
  @ApiCreatedData(TokenResponseDto, 'User successfully registered')
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'This email has been used' })
  @ApiUnauthorizedResponse({ description: 'Password is required' })
  register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.register(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Login',
    description:
      'Authenticates a user with email and password, returning access and refresh tokens.',
  })
  @ApiOkData(TokenResponseDto, 'Successfully logged in')
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({
    description:
      'User not found / Please use Google to log in / Invalid email or password',
  })
  logIn(
    @Body() dto: LogInUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.logIn(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh token rotation',
    description:
      'Issues a new pair of tokens using a valid refresh token. Revokes the old token and detects token reuse.',
  })
  @ApiCreatedData(TokenResponseDto, 'Successfully refreshed tokens')
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiConflictResponse({ description: 'Invalid token' })
  refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes the provided refresh token to log the user out.',
  })
  @ApiCreatedData(MessageResponseDto, 'Successfully logged out')
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  logOut(@Body() dto: RefreshTokenDto) {
    return this.authService.logOut(dto);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current user's profile",
    description:
      'Retrieves the profile information of the currently authenticated user.',
  })
  @ApiOkData(ProfileResponseDto, 'Successfully retrieved profile')
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getProfile(@Req() req: { user: unknown }) {
    return req.user;
  }

  @Public()
  @Get('google')
  @ApiOperation({
    summary:
      'Google Oauth login, cannot test on Swagger, test directly on your browser',
    description:
      'Initiates the Google OAuth2 login flow. Redirects the user to Google for authentication.',
  })
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('google/callback')
  @ApiOperation({
    summary:
      'Callback after logging in Google, cannot test on Swagger, test directly on your browser',
    description:
      'Handles the callback from Google OAuth2. Creates a new user or issues a pending link token if the email already exists locally.',
  })
  @ApiOkOneOfData(
    [TokenResponseDto, LinkConfirmationResponseDto],
    'Logged in with Google, or account linking confirmation is required',
  )
  @ApiUnauthorizedResponse({ description: 'Google authentication failed' })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: { user: { fullName: string; email: string } },
  ) {
    return this.authService.googleLogin(req.user);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('google/confirm-link')
  @ApiOperation({
    summary: 'Checking Oauth logging in account already has a local account',
    description:
      'Confirms linking a Google account to an existing local account using a pending link token and the local account password.',
  })
  @ApiCreatedData(TokenResponseDto, 'Successfully linked Google account')
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({
    description:
      'Link token invalid or expired / Invalid token purpose / User not found / Password is required / Invalid password',
  })
  async confirmLinkGoogleAccount(@Body() dto: ConfirmLinkGoogleDto) {
    return this.authService.confirmLinkGoogleAccount(dto);
  }
}
