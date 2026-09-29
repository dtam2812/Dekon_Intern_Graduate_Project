/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Logger } from 'nestjs-pino';
import {
  RefreshToken,
  RefreshTokenDocument,
} from 'src/schemas/refreshToken.schema';
import { User, UserDocument } from 'src/schemas/user.schema';
import type { StringValue } from 'ms';
import { generateRefreshToken, hashToken } from 'src/service/TokenHashing';
import { comparePassword, hashPassword } from 'src/service/PasswordHashing';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { LogInUserDto } from 'src/dto/logIn-user.dto';
import { RefreshTokenDto } from 'src/dto/refresh-token.dto';
import { RegisterDto } from 'src/dto/register.dto';
import { UserRole } from 'src/enum/userRole.enum';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RefreshToken.name)
    private readonly refreshTokenModel: Model<RefreshTokenDocument>,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  private async issueToken(
    id: string,
    email: string,
    fullName: string,
    role: string,
    provider: string,
    familyId: string,
    session?: ClientSession,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: id,
        email,
        fullName,
        role,
        purpose: 'access',
      },
      {
        expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as StringValue,
      },
    );

    const rawRefreshToken = generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 7),
    );

    await this.refreshTokenModel.create(
      [
        {
          token: hashToken(rawRefreshToken),
          userId: id,
          familyId,
          revoked: false,
          expiresAt,
        },
      ],
      { session },
    );

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const existedEmail = await this.userModel.findOne({ email: dto.email });

      if (existedEmail) {
        this.logger.warn('Registration failed: email already used');
        throw new ConflictException('This email has been used');
      }

      if (!dto.password) {
        this.logger.warn('Registration failed: password is required');
        throw new UnauthorizedException('Password is required');
      }

      const hashedPassword = await hashPassword(dto.password);

      const user = await this.userModel.create({
        fullName: dto.fullName,
        email: dto.email,
        password: hashedPassword,
        role: UserRole.CUSTOMER,
        provider: AuthProvider.LOCAL,
      });

      this.logger.log(`User ${user.id} registered`);

      const familyId = crypto.randomUUID();

      return this.issueToken(
        user.id,
        user.email,
        user.fullName,
        user.role,
        user.provider,
        familyId,
      );
    } catch (error) {
      if (error.code === 11000) {
        this.logger.warn('Registration failed: duplicate email (index)');
        throw new ConflictException('This email has been used');
      }
      throw error;
    }
  }

  async logIn(
    dto: LogInUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userModel
      .findOne({ email: dto.email })
      .select('+password');

    if (!user) {
      this.logger.warn('Login failed: user not found');
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      this.logger.warn(`Login failed: user ${user.id} must use Google login`);
      throw new UnauthorizedException('Please use Google to log in');
    }

    const isMatchedPassword = await comparePassword(
      dto.password,
      user.password,
    );

    if (!isMatchedPassword) {
      this.logger.warn(`Login failed: wrong password for user ${user.id}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User ${user.id} logged in`);

    const familyId = crypto.randomUUID();

    return this.issueToken(
      user.id,
      user.email,
      user.fullName,
      user.role,
      user.provider,
      familyId,
    );
  }

  async refreshToken(
    dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const hashedToken = hashToken(dto.refreshToken);

    const session = await this.refreshTokenModel.db.startSession();

    try {
      let result: { accessToken: string; refreshToken: string } | undefined;
      let reuseDetected = false;

      await session.withTransaction(async () => {
        result = undefined;
        reuseDetected = false;

        const record = await this.refreshTokenModel
          .findOne({ token: hashedToken })
          .session(session)
          .populate<{ userId: UserDocument }>('userId');

        if (!record) {
          this.logger.warn('Refresh failed: token not found');
          throw new ConflictException('Invalid token');
        }

        if (record.revoked === true) {
          this.logger.warn(
            `Refresh token reuse detected (family ${record.familyId}), revoking the whole family`,
          );
          await this.refreshTokenModel.updateMany(
            { familyId: record.familyId },
            { revoked: true },
            { session },
          );
          reuseDetected = true;
          return;
        }

        if (record.expiresAt < new Date()) {
          this.logger.warn(
            `Refresh failed: token expired (family ${record.familyId})`,
          );
          throw new ConflictException('Invalid token');
        }

        const consumeResult = await this.refreshTokenModel.updateOne(
          {
            token: hashedToken,
            revoked: false,
          },
          { revoked: true },
          { session },
        );

        if (consumeResult.matchedCount === 0) {
          this.logger.warn(
            `Concurrent refresh token reuse detected (family ${record.familyId}), revoking the whole family`,
          );
          await this.refreshTokenModel.updateMany(
            { familyId: record.familyId },
            { revoked: true },
            { session },
          );
          reuseDetected = true;
          return;
        }

        const user = record.userId;

        result = await this.issueToken(
          user.id,
          user.email,
          user.fullName,
          user.role,
          user.provider,
          record.familyId,
          session,
        );
      });

      if (reuseDetected || !result) {
        throw new ConflictException('Invalid token');
      }
      this.logger.log('Refresh token rotated successfully');
      return result;
    } finally {
      await session.endSession();
    }
  }

  async logOut(dto: RefreshTokenDto): Promise<{ message: string }> {
    const hashedToken = hashToken(dto.refreshToken);

    await this.refreshTokenModel.updateOne(
      { token: hashedToken },
      { revoked: true },
    );

    this.logger.log('Refresh token revoked on logout');

    return { message: 'Logged out successfully' };
  }

  async googleLogin(googleUser: { fullName: string; email: string }) {
    const existedEmail = await this.userModel.findOne({
      email: googleUser.email,
    });

    if (existedEmail && existedEmail.provider === AuthProvider.LOCAL) {
      this.logger.log(
        `Google login for user ${existedEmail.id} requires account link confirmation`,
      );
      return this.creatingPendingLinkToken(existedEmail, googleUser);
    }

    let user: UserDocument | null;
    try {
      user = await this.userModel.findOneAndUpdate(
        { email: googleUser.email },
        {
          $setOnInsert: {
            fullName: googleUser.fullName,
            email: googleUser.email,
            role: UserRole.CUSTOMER,
            provider: AuthProvider.GOOGLE,
          },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      if (error.code === 11000) {
        this.logger.warn(
          'Google login upsert conflict, fetching the existing user instead',
        );
        user = await this.userModel.findOne({ email: googleUser.email });
      } else {
        throw error;
      }
    }

    if (!user) {
      this.logger.warn('Google login failed: user not found after upsert');
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`User ${user.id} logged in with Google`);

    const familyId = crypto.randomUUID();
    return this.issueToken(
      user.id,
      user.email,
      user.fullName,
      user.role,
      user.provider,
      familyId,
    );
  }

  private async creatingPendingLinkToken(
    existedUser: UserDocument,
    googleProfile: { email: string; fullName: string },
  ) {
    const pendingLinkToken = await this.jwtService.signAsync(
      {
        sub: existedUser.id,
        purpose: 'google-link',
        googleFullName: googleProfile.fullName,
      },
      {
        expiresIn: '10m',
      },
    );

    this.logger.log(`Pending link token issued for user ${existedUser.id}`);

    return { requireLinkConfirmation: true, pendingLinkToken };
  }

  async confirmLinkGoogleAccount(pendingLinkToken: string, password: string) {
    let payload: { sub: string; purpose: string; googleFullName: string };

    try {
      payload = this.jwtService.verify(pendingLinkToken);
    } catch (error) {
      this.logger.warn('Google link failed: link token invalid or expired');
      throw new UnauthorizedException('Link token invalid or expired');
    }

    if (payload.purpose !== 'google-link') {
      this.logger.warn(
        `Google link failed: invalid token purpose for user ${payload.sub}`,
      );
      throw new UnauthorizedException('Invalid token purpose');
    }

    const user = await this.userModel.findById(payload.sub).select('+password');
    if (!user) {
      this.logger.warn(`Google link failed: user ${payload.sub} not found`);
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      this.logger.warn(`Google link failed: user ${user.id} has no password`);
      throw new UnauthorizedException('Password is required');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(
        `Google link failed: wrong password for user ${user.id}`,
      );
      throw new UnauthorizedException('Invalid password');
    }

    user.provider = AuthProvider.GOOGLE;
    await user.save();

    this.logger.log(`Google account linked for user ${user.id}`);

    const familyId = crypto.randomUUID();
    return this.issueToken(
      user.id,
      user.email,
      user.fullName,
      user.role,
      user.provider,
      familyId,
    );
  }
}
