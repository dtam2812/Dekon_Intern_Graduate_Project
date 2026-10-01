import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getModelToken } from '@nestjs/mongoose';
import { User } from 'src/schemas/user.schema';
import { RefreshToken } from 'src/schemas/refreshToken.schema';
import { JwtService } from '@nestjs/jwt';
import { Logger } from 'nestjs-pino';
import { comparePassword, hashPassword } from 'src/service/PasswordHashing';
import { generateRefreshToken, hashToken } from 'src/service/TokenHashing';
import { UserRole } from 'src/enum/userRole.enum';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

jest.mock('src/service/PasswordHashing');
jest.mock('src/service/TokenHashing');

describe('AuthService', () => {
  let service: AuthService;

  const mockHashPassword = hashPassword as jest.Mock;
  const mockComparePassword = comparePassword as jest.Mock;
  const mockGenerateRefreshToken = generateRefreshToken as jest.Mock;
  const mockHashToken = hashToken as jest.Mock;

  const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
  };

  const mockSession = {
    withTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  const mockRefreshTokenModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
    updateOne: jest.fn(),
    db: { startSession: jest.fn() },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockLogger = { warn: jest.fn(), log: jest.fn() };

  const userId = '507f1f77bcf86cd799439011';

  let mockUser: {
    id: string;
    email: string;
    fullName: string;
    password: string;
    role: UserRole;
    provider: AuthProvider;
    save: jest.Mock;
  };

  const mockOAuthUser = {
    id: userId,
    email: 'test@example.com',
    fullName: 'Test User',
    role: UserRole.CUSTOMER,
    provider: AuthProvider.GOOGLE,
  };

  const expectedTokens = {
    accessToken: 'access-token',
    refreshToken: 'raw-refresh-token',
  };

  const mockSelect = (value: unknown) => ({
    select: jest.fn().mockResolvedValue(value),
  });

  const mockFindRefreshToken = (value: unknown) => {
    const populate = jest.fn().mockResolvedValue(value);
    const session = jest.fn().mockReturnValue({ populate });
    mockRefreshTokenModel.findOne.mockReturnValue({ session });
  };

  beforeEach(async () => {
    mockUser = {
      id: userId,
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'hashed-password',
      role: UserRole.CUSTOMER,
      provider: AuthProvider.LOCAL,
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: getModelToken(RefreshToken.name),
          useValue: mockRefreshTokenModel,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    mockJwtService.signAsync.mockResolvedValue('access-token');
    mockRefreshTokenModel.create.mockResolvedValue([{}]);
    mockGenerateRefreshToken.mockReturnValue('raw-refresh-token');
    mockHashToken.mockImplementation((token: string) => `hashed-${token}`);
    mockRefreshTokenModel.db.startSession.mockResolvedValue(mockSession);
    mockSession.withTransaction.mockImplementation(
      async (fn: () => Promise<void>) => {
        await fn();
      },
    );
    mockSession.endSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto = {
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    };
    it('should register a new user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hashed-password');
      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: dto.email });
      expect(mockHashPassword).toHaveBeenCalledWith(dto.password);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        fullName: dto.fullName,
        email: dto.email,
        password: 'hashed-password',
        role: UserRole.CUSTOMER,
        provider: AuthProvider.LOCAL,
      });
      expect(result).toEqual(expectedTokens);
    });

    it('should throw ConflictException if email is already used', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is missing', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      await expect(service.register({ ...dto, password: '' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate key error', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hashed-password');
      mockUserModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('Login', () => {
    const dto = {
      email: 'test@example.com',
      password: 'Password123!',
    };
    it('should let user log in the system', async () => {
      mockUserModel.findOne.mockReturnValue(mockSelect(mockUser));
      mockComparePassword.mockResolvedValue(true);

      const result = await service.logIn(dto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: dto.email });
      expect(mockComparePassword).toHaveBeenCalledWith(
        dto.password,
        'hashed-password',
      );
      expect(result).toEqual(expectedTokens);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserModel.findOne.mockReturnValue(mockSelect(null));

      await expect(service.logIn(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user using OAuth', async () => {
      mockUserModel.findOne.mockReturnValue(mockSelect(mockOAuthUser));

      await expect(service.logIn(dto)).rejects.toThrow(UnauthorizedException);
      expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockUserModel.findOne.mockReturnValue(mockSelect(mockUser));
      mockComparePassword.mockResolvedValue(false);

      await expect(service.logIn(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    const dto = { refreshToken: 'old-refresh-token' };
    const hashedOldToken = 'hashed-old-refresh-token';

    const mockRefreshToken = (
      revoked: boolean,
      expiresAt = new Date(Date.now() + 60 * 1000),
    ) => ({
      token: hashedOldToken,
      familyId: 'family-1',
      revoked: revoked,
      expiresAt: expiresAt,
      userId: mockUser, // populated user, not the raw id string
    });
    it('should rotate old token and create a new one', async () => {
      mockFindRefreshToken(mockRefreshToken(false));
      mockRefreshTokenModel.updateOne.mockResolvedValue({ matchedCount: 1 });

      const result = await service.refreshToken(dto);

      expect(mockRefreshTokenModel.updateOne).toHaveBeenCalledWith(
        { token: hashedOldToken, revoked: false },
        { revoked: true },
        { session: mockSession },
      );
      expect(mockRefreshTokenModel.create).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            token: 'hashed-raw-refresh-token',
            userId,
            familyId: 'family-1',
            revoked: false,
          }),
        ],
        { session: mockSession },
      );
      expect(mockRefreshTokenModel.updateMany).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: userId,
          email: mockUser.email,
          fullName: mockUser.fullName,
          role: mockUser.role,
          purpose: 'access',
        },
        { expiresIn: '15m' },
      );
      expect(mockSession.endSession).toHaveBeenCalled();
      expect(result).toEqual(expectedTokens);
    });

    it('should throw ConflictException if token is not found', async () => {
      mockFindRefreshToken(null);

      await expect(service.refreshToken(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRefreshTokenModel.create).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should revoke the whole family if a revoked token is reused', async () => {
      mockFindRefreshToken(mockRefreshToken(true));

      await expect(service.refreshToken(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRefreshTokenModel.updateMany).toHaveBeenCalledWith(
        { familyId: 'family-1' },
        { revoked: true },
        { session: mockSession },
      );
      expect(mockRefreshTokenModel.create).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('should throw ConflictException if token is expired', async () => {
      mockFindRefreshToken(
        mockRefreshToken(false, new Date(Date.now() - 1000)),
      );

      await expect(service.refreshToken(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRefreshTokenModel.updateOne).not.toHaveBeenCalled();
      expect(mockRefreshTokenModel.create).not.toHaveBeenCalled();
    });

    it('should revoke the whole family on concurrent reuse (matchedCount = 0)', async () => {
      mockFindRefreshToken(mockRefreshToken(false));
      mockRefreshTokenModel.updateOne.mockResolvedValue({ matchedCount: 0 });

      await expect(service.refreshToken(dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockRefreshTokenModel.updateMany).toHaveBeenCalledWith(
        { familyId: 'family-1' },
        { revoked: true },
        { session: mockSession },
      );
      expect(mockRefreshTokenModel.create).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('Logout', () => {
    it('should let a user log out of the system', async () => {
      mockRefreshTokenModel.updateOne.mockResolvedValue({ matchedCount: 1 });

      const result = await service.logOut({ refreshToken: 'token' });

      expect(mockRefreshTokenModel.updateOne).toHaveBeenCalledWith(
        { token: 'hashed-token' },
        { revoked: true },
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('googleLogin', () => {
    const googleUser = { fullName: 'Test User', email: 'test@example.com' };

    it('should require link confirmation if a local account already exists', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      const result = await service.googleLogin(googleUser);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          sub: userId,
          purpose: 'google-link',
          googleFullName: googleUser.fullName,
        },
        { expiresIn: '10m' },
      );
      expect(result).toEqual({
        requireLinkConfirmation: true,
        pendingLinkToken: 'access-token',
      });
      expect(mockUserModel.findOneAndUpdate).not.toHaveBeenCalled();
      expect(mockRefreshTokenModel.create).not.toHaveBeenCalled();
    });

    it('should create a new Google user (upsert) and return tokens', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.findOneAndUpdate.mockResolvedValue(mockOAuthUser);

      const result = await service.googleLogin(googleUser);

      expect(mockUserModel.findOneAndUpdate).toHaveBeenCalledWith(
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
      expect(result).toEqual(expectedTokens);
    });

    it('should log in an existing Google user', async () => {
      mockUserModel.findOne.mockResolvedValue(mockOAuthUser);
      mockUserModel.findOneAndUpdate.mockResolvedValue(mockOAuthUser);

      const result = await service.googleLogin(googleUser);

      expect(result).toEqual(expectedTokens);
    });

    it('should fetch the existing user if upsert hits a duplicate key error', async () => {
      mockUserModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockOAuthUser);
      mockUserModel.findOneAndUpdate.mockRejectedValue({ code: 11000 });

      const result = await service.googleLogin(googleUser);

      expect(mockUserModel.findOne).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expectedTokens);
    });

    it('should throw UnauthorizedException if user is still not found after upsert', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.googleLogin(googleUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rethrow unexpected upsert errors', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.findOneAndUpdate.mockRejectedValue(new Error('DB down'));

      await expect(service.googleLogin(googleUser)).rejects.toThrow('DB down');
    });
  });

  describe('confirmLinkGoogleAccount', () => {
    const pendingLinkToken = 'pending-link-token';
    const password = 'Password123!';
    const validPayload = {
      sub: userId,
      purpose: 'google-link',
      googleFullName: 'Test User',
    };

    it('should link the Google account and return tokens', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserModel.findById.mockReturnValue(mockSelect(mockUser));
      mockComparePassword.mockResolvedValue(true);

      const result = await service.confirmLinkGoogleAccount(
        pendingLinkToken,
        password,
      );

      expect(mockJwtService.verify).toHaveBeenCalledWith(pendingLinkToken);
      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(mockUser.provider).toBe(AuthProvider.GOOGLE);
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual(expectedTokens);
    });

    it('should throw UnauthorizedException if link token is invalid or expired', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.confirmLinkGoogleAccount(pendingLinkToken, password),
      ).rejects.toThrow('Link token invalid or expired');
      expect(mockUserModel.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if token purpose is not google-link', async () => {
      mockJwtService.verify.mockReturnValue({
        ...validPayload,
        purpose: 'access',
      });

      await expect(
        service.confirmLinkGoogleAccount(pendingLinkToken, password),
      ).rejects.toThrow('Invalid token purpose');
      expect(mockUserModel.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserModel.findById.mockReturnValue(mockSelect(null));

      await expect(
        service.confirmLinkGoogleAccount(pendingLinkToken, password),
      ).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedException if user has no password', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserModel.findById.mockReturnValue(mockSelect(mockOAuthUser));

      await expect(
        service.confirmLinkGoogleAccount(pendingLinkToken, password),
      ).rejects.toThrow('Password is required');
      expect(mockComparePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is wrong and not link the account', async () => {
      mockJwtService.verify.mockReturnValue(validPayload);
      mockUserModel.findById.mockReturnValue(mockSelect(mockUser));
      mockComparePassword.mockResolvedValue(false);

      await expect(
        service.confirmLinkGoogleAccount(pendingLinkToken, password),
      ).rejects.toThrow('Invalid password');
      expect(mockUser.provider).toBe(AuthProvider.LOCAL);
      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });
});
