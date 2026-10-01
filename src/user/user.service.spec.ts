import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { hashPassword } from 'src/service/PasswordHashing';
import { UserRole } from 'src/enum/userRole.enum';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { UserService } from './user.service';
import {
  BadRequestException,
  ConflictException,
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
    it("should update current user's information, without password", async () => {
      const dto = {
        fullName: 'tam dinh',
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.update(userId, dto);

      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        dto,
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it("should update current user's information, with password", async () => {
      const dto = {
        fullName: 'tam dinh',
        password: 'password123',
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockHashPassword.mockResolvedValue('hashed-password');

      const result = await service.update(userId, dto);

      expect(mockHashPassword).toHaveBeenCalledWith(dto.password);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { ...dto, password: 'hashed-password' },
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it('should return NotFoundException if user not found', async () => {
      const dto = {
        fullName: 'tam dinh',
        password: 'password123',
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(service.update(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Update admin', () => {
    it("should update current user's information, without password", async () => {
      const dto = {
        fullName: 'tam dinh',
        role: UserRole.STAFF,
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await service.updateAdmin(userId, dto);

      expect(mockHashPassword).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        dto,
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it("should update current user's information, with password", async () => {
      const dto = {
        fullName: 'tam dinh',
        role: UserRole.STAFF,
        password: 'password123',
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockHashPassword.mockResolvedValue('hashed-password');

      const result = await service.updateAdmin(userId, dto);

      expect(mockHashPassword).toHaveBeenCalledWith(dto.password);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { ...dto, password: 'hashed-password' },
        { new: true },
      );
      expect(result).toEqual(userResponse);
    });

    it('should return NotFoundException if user not found', async () => {
      const dto = {
        fullName: 'tam dinh',
        role: UserRole.STAFF,
        password: 'password123',
      };
      mockUserModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(service.updateAdmin(userId, dto)).rejects.toThrow(
        NotFoundException,
      );
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
