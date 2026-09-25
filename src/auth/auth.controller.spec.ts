import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/guard/role.guard';
import request from 'supertest';

describe('AuthController', () => {
  let controller: AuthController;
  let app: INestApplication;

  const mockAuthService = {
    register: jest.fn(),
    logIn: jest.fn(),
    refreshToken: jest.fn(),
    logOut: jest.fn(),
    getProfile: jest.fn(),
    googleAuth: jest.fn(),
    googleAuthCallback: jest.fn(),
    confirmLinkGoogleAccount: jest.fn(),
  };

  const mockAuthGuard = { canActivate: () => true };
  const mockRolesGuard = { canActivate: () => true };

  beforeEach(async () => {
    mockAuthGuard.canActivate = (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'mockUserId' };
      return true;
    };
    mockRolesGuard.canActivate = () => true;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    app = module.createNestApplication();
    app.useGlobalGuards(mockAuthGuard, mockRolesGuard);
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/register', () => {
    const dto = {
      fullName: 'abcd',
      email: 'tam@gmail.com',
      password: '12345',
    };
    const id = '507f1f77bcf86cd799439011';
    it('should let a user register new account and return 201', async () => {
      const result = {
        accessToken: '1ekoqeok-022ke2-kkqok-dokdokdoqkw',
        refreshToken: 'dnd2j09j09j0j0j20fj00f8408jc98w',
      };
      mockAuthService.register.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(result);
      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('POST /auth/login', () => {
    const logInDto = {
      email: 'tam@gmail.com',
      password: '12345',
    };

    const result = {
      accessToken: '1ekoqeok-022ke2-kkqok-dokdokdoqkw',
      refreshToken: 'dnd2j09j09j0j0j20fj00f8408jc98w',
    };
    it('should let a user log in and return 200', async () => {
      mockAuthService.logIn.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(logInDto)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockAuthService.logIn).toHaveBeenCalledWith(logInDto);
    });

    it('should return 401 if email not found', async () => {
      mockAuthService.logIn.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(logInDto)
        .expect(401);

      expect(mockAuthService.logIn).toHaveBeenCalledWith(logInDto);
    });

    it('should return 401 if password is wrong', async () => {
      mockAuthService.logIn.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(logInDto)
        .expect(401);

      expect(mockAuthService.logIn).toHaveBeenCalledWith(logInDto);
    });
  });

  describe('POST /auth/refresh', () => {
    const result = {
      accessToken: '1ekoqeok-022ke2-kkqok-dokdokdoqkw',
      refreshToken: 'dnd2j09j09j0j0j20fj00f8408jc98w',
    };
    const refreshTokenDto = {
      refreshToken: 'dnd2j09j09j0j0j20fj00f8408jc98w',
    };
    it('should revoke expired token and return a new one with an access token', async () => {
      mockAuthService.refreshToken.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshTokenDto)
        .expect(201);

      expect(res.body).toEqual(result);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto,
      );
    });

    it('should return 409 if refresh token not found', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new ConflictException('Invalid token'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshTokenDto)
        .expect(409);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto,
      );
    });

    it('should return 409 if refresh token expired', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new ConflictException('Invalid token'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshTokenDto)
        .expect(409);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto,
      );
    });

    it('should return 409 if revoked refresh token detected', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new ConflictException('Invalid token'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send(refreshTokenDto)
        .expect(409);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto,
      );
    });
  });

  describe('POST /auth/logout', () => {
    const refreshTokenDto = {
      refreshToken: 'dnd2j09j09j0j0j20fj00f8408jc98w',
    };
    it('should let a user log out and return a message', async () => {
      const result = { message: 'Logged out successfully' };
      mockAuthService.logOut.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .send(refreshTokenDto)
        .expect(201);

      expect(res.body).toEqual(result);
      expect(mockAuthService.logOut).toHaveBeenCalledWith(refreshTokenDto);
    });
  });

  describe('GET /auth/profile', () => {
    it("should return 200 and a user's profile", async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(200);

      expect(res.body).toEqual({ sub: 'mockUserId' });
    });
  });
});
