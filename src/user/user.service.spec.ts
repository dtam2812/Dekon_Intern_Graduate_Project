import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { comparePassword, hashPassword } from 'src/service/PasswordHashing';
import { UserRole } from 'src/enum/userRole.enum';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { UserService } from './user.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { User } from 'src/schemas/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

jest.mock('src/service/PasswordHashing');
jest.mock('src/service/TokenHashing');

describe('UserService', () => {
  let service: UserService;

  const mockHashPassword = hashPassword as jest.Mock;
  const mockComparePassword = comparePassword as jest.Mock;

  const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findById: jest.fn(),
  };

  const mockLogger = { warn: jest.fn(), log: jest.fn() };

  const userId = '507f1f77bcf86cd799439011';

  let userResponse: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
  };

  let mockUser: {
    _id: Types.ObjectId;
    id: string;
    email: string;
    fullName: string;
    password: string;
    role: UserRole;
    provider: AuthProvider;
    save: jest.Mock;
    toJSON: () => typeof userResponse;
  };

  beforeEach(async () => {
    mockUser = {
      _id: new Types.ObjectId(userId),
      id: userId,
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'hashed-password',
      role: UserRole.CUSTOMER,
      provider: AuthProvider.LOCAL,
      save: jest.fn(),
      toJSON: () => userResponse,
    };

    userResponse = {
      id: userId,
      email: 'tam@gmail.com',
      fullName: 'tam dinh',
      role: UserRole.CUSTOMER,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Create user', () => {
    const dto = {
      fullName: 'tam dinh',
      email: 'tam@gmail.com',
      password: 'password123@',
      role: UserRole.CUSTOMER,
      provider: AuthProvider.LOCAL,
    };
    it('should create new user', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hashed-password');
      mockUserModel.create.mockResolvedValue(mockUser);

      const result = await service.create(dto);

      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: dto.email });
      expect(mockHashPassword).toHaveBeenCalledWith(dto.password);
      expect(mockUserModel.create).toHaveBeenCalledWith({
        fullName: dto.fullName,
        email: dto.email,
        password: 'hashed-password',
        role: UserRole.CUSTOMER,
        provider: AuthProvider.LOCAL,
      });
      expect(result).toEqual(userResponse);
    });

    it('should throw ConflictException if email already existed', async () => {
      mockUserModel.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if password is missing', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      await expect(service.create({ ...dto, password: '' })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate key error', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue('hashed-password');
      mockUserModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected create errors', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create(dto)).rejects.toThrow('DB down');
    });
  });

  describe('Find all', () => {
    it('should return list of users', async () => {
      mockUserModel.find.mockResolvedValue([mockUser, mockUser]);

      const result = await service.findAll();

      expect(mockUserModel.find).toHaveBeenCalled();
      expect(result).toEqual([userResponse, userResponse]);
    });

    it('should return an empty array if system has no user', async () => {
      mockUserModel.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(mockUserModel.find).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('Find a user', () => {
    it('should return a user', async () => {
      mockUserModel.findById.mockResolvedValue(mockUser);

      const result = await service.findOne(userId);

      expect(mockUserModel.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(userResponse);
    });

    it('should return NotFoundException if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Update a user', () => {
    const localUser = {
      ...mockUser,
      provider: AuthProvider.LOCAL,
      email: 'old@test.com',
      password: 'hashed-old',
      toJSON: () => userResponse,
    };

    const googleUser = {
      ...mockUser,
      provider: AuthProvider.GOOGLE,
      email: 'google@test.com',
      password: undefined,
      toJSON: () => userResponse,
    };

    const mockFindById = (user: unknown) => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(user),
      });
    };

    it("should update current user's information, without password", async () => {
      const dto = { fullName: 'tam dinh' };
      mockFindById(localUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.update(userId, dto);

      expect(mockComparePassword).not.toHaveBeenCalled();
      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { fullName: 'tam dinh' },
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it("should update current user's information, with password", async () => {
      const dto = {
        fullName: 'tam dinh',
        currentPassword: 'old-password',
        newPassword: 'password123',
      };
      mockFindById(localUser);
      mockComparePassword.mockResolvedValue(true);
      mockHashPassword.mockResolvedValue('hashed-password');
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.update(userId, dto);

      expect(mockComparePassword).toHaveBeenCalledWith(
        'old-password',
        'hashed-old',
      );
      expect(mockHashPassword).toHaveBeenCalledWith('password123');
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { fullName: 'tam dinh', password: 'hashed-password' },
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it('should update email (lowercased) when current password is correct', async () => {
      const dto = { email: '  New@Test.com ', currentPassword: 'old-password' };
      mockFindById(localUser);
      mockComparePassword.mockResolvedValue(true);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      await service.update(userId, dto);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { email: 'new@test.com' },
        { new: true },
      );
    });

    it('should return current user without updating if nothing changed', async () => {
      mockFindById(localUser);

      const result = await service.update(userId, {});

      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(result).toEqual(userResponse);
    });

    it('should throw BadRequestException if newPassword is sent without currentPassword', async () => {
      mockFindById(localUser);

      await expect(
        service.update(userId, { newPassword: 'password123' }),
      ).rejects.toThrow(BadRequestException);

      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if currentPassword is incorrect', async () => {
      mockFindById(localUser);
      mockComparePassword.mockResolvedValue(false);

      await expect(
        service.update(userId, {
          currentPassword: 'wrong',
          newPassword: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it.each([
      ['email', { email: 'new@test.com' }],
      ['currentPassword', { currentPassword: 'old-password' }],
      ['newPassword', { newPassword: 'password123' }],
    ])(
      'should throw BadRequestException if Google account sends %s',
      async (_field, dto) => {
        mockFindById(googleUser);

        await expect(service.update(userId, dto)).rejects.toThrow(
          BadRequestException,
        );

        expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
      },
    );

    it('should still allow Google account to update fullName', async () => {
      mockFindById(googleUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.update(userId, { fullName: 'tam dinh' });

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { fullName: 'tam dinh' },
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockFindById(null);

      await expect(
        service.update(userId, { fullName: 'tam dinh' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user disappears before update', async () => {
      mockFindById(localUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.update(userId, { fullName: 'tam dinh' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if email already in use (Mongo 11000)', async () => {
      mockFindById(localUser);
      mockComparePassword.mockResolvedValue(true);
      mockUserModel.findByIdAndUpdate.mockRejectedValue({ code: 11000 });

      await expect(
        service.update(userId, {
          email: 'taken@test.com',
          currentPassword: 'old-password',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Update admin', () => {
    const adminId = 'admin-id-123';

    it("should update another user's role", async () => {
      const dto = { role: UserRole.STAFF };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.updateAdmin(userId, dto, adminId);

      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { role: UserRole.STAFF },
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it('should throw ForbiddenException if admin changes their own role', async () => {
      await expect(
        service.updateAdmin(adminId, { role: UserRole.STAFF }, adminId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.updateAdmin(userId, { role: UserRole.STAFF }, adminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Delete user', () => {
    it('should delete a user', async () => {
      mockUserModel.findByIdAndDelete.mockResolvedValue(mockUser);

      const result = await service.remove(userId);

      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ message: 'user deleted' });
    });

    it('should return NotFoundException if user not found', async () => {
      mockUserModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.remove(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
