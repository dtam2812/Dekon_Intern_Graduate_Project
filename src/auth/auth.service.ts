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
import { Model } from 'mongoose';
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
  ) {}

  private async issueToken(
    id: string,
    email: string,
    fullName: string,
    role: string,
    provider: string,
    familyId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: id,
        email,
        fullName,
        role,
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

    await this.refreshTokenModel.create({
      token: hashToken(rawRefreshToken),
      userId: id,
      familyId,
      revoked: false,
      expiresAt,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const existedEmail = await this.userModel.findOne({ email: dto.email });

      if (existedEmail) {
        throw new ConflictException('This email has been used');
      }

      if (!dto.password) {
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
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      throw new UnauthorizedException('Please use Google to log in');
    }

    const isMatchedPassword = await comparePassword(
      dto.password,
      user.password,
    );

    if (!isMatchedPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

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

    const record = await this.refreshTokenModel
      .findOne({ token: hashedToken })
      .populate<{ userId: UserDocument }>('userId');

    if (!record) {
      throw new ConflictException('Invalid token');
    }

    if (record.revoked === true) {
      await this.refreshTokenModel.updateMany(
        { familyId: record.familyId },
        { revoked: true },
      );
      throw new ConflictException('Invalid token');
    }

    if (record.expiresAt < new Date()) {
      throw new ConflictException('Invalid token');
    }

    await this.refreshTokenModel.updateOne(
      { token: hashedToken },
      { revoked: true },
    );

    const user = record.userId;

    return this.issueToken(
      user.id,
      user.email,
      user.fullName,
      user.role,
      user.provider,
      record.familyId,
    );
  }

  async logOut(dto: RefreshTokenDto): Promise<{ message: string }> {
    const hashedToken = hashToken(dto.refreshToken);

    await this.refreshTokenModel.updateOne(
      { token: hashedToken },
      { revoked: true },
    );

    return { message: 'Logged out successfully' };
  }

  async googleLogin(googleUser: { fullName: string; email: string }) {
    const existedEmail = await this.userModel.findOne({
      email: googleUser.email,
    });

    if (existedEmail && existedEmail.provider === AuthProvider.LOCAL) {
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
        user = await this.userModel.findOne({ email: googleUser.email });
      } else {
        throw error;
      }
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

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

    return { requireLinkConfirmation: true, pendingLinkToken };
  }

  async confirmLinkGoogleAccount(pendingLinkToken: string, password: string) {
    let payload: { sub: string; purpose: string; googleFullName: string };

    try {
      payload = this.jwtService.verify(pendingLinkToken);
    } catch (error) {
      throw new UnauthorizedException('Link token invalid or expired');
    }

    if (payload.purpose !== 'google-link') {
      throw new UnauthorizedException('Invalid token purpose');
    }

    const user = await this.userModel.findById(payload.sub).select('+password');
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.password) {
      throw new UnauthorizedException('Password is required');
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    user.provider = AuthProvider.GOOGLE;
    await user.save();

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
