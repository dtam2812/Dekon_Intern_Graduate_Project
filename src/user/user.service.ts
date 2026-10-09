import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logger } from 'nestjs-pino';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { UpdateUserAdminDto } from 'src/dto/update-user-admin.dto';
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { UserResponseDto } from 'src/dto/user-response.dto';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { User, UserDocument } from 'src/schemas/user.schema';
import { comparePassword, hashPassword } from 'src/service/PasswordHashing';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    try {
      const existedEmail = await this.userModel.findOne({ email: dto.email });

      if (existedEmail) {
        this.logger.warn('User creation failed: email already used');
        throw new ConflictException('This email has been used');
      }

      if (!dto.password) {
        this.logger.warn('User creation failed: password is required');
        throw new BadRequestException('Password is required');
      }

      const hashedPassword = await hashPassword(dto.password);

      const user = await this.userModel.create({
        fullName: dto.fullName,
        email: dto.email.trim().toLowerCase(),
        password: hashedPassword,
        role: dto.role,
        provider: AuthProvider.LOCAL,
      });

      this.logger.log(
        `User ${user._id.toString()} created with role ${dto.role}`,
      );

      return user.toJSON() as UserResponseDto;
    } catch (error: unknown) {
      const mongoError = error as { code?: number };
      if (mongoError.code === 11000) {
        this.logger.warn('User creation failed: duplicate email (index)');
        throw new ConflictException('This email has been used');
      }
      throw error;
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userModel.find();
    return users.map((element) => element.toJSON()) as UserResponseDto[];
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id);

    if (!user) {
      this.logger.warn(`User ${id} not found`);
      throw new NotFoundException('user not found');
    }

    return user.toJSON() as UserResponseDto;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userModel.findById(id).select('+password');

    if (!user) {
      this.logger.warn(`Update failed: user ${id} not found`);
      throw new NotFoundException('User not found');
    }

    const { currentPassword, newPassword, email, ...rest } = dto;
    const updatedData: Record<string, unknown> = { ...rest };

    const isGoogleLinked = user.provider === AuthProvider.GOOGLE;

    if (
      isGoogleLinked &&
      (email !== undefined ||
        currentPassword !== undefined ||
        newPassword !== undefined)
    ) {
      throw new BadRequestException(
        'This account uses Google sign-in, so email and password cannot be changed',
      );
    }

    const normalizedEmail = email?.trim().toLowerCase();
    const isChangingEmail =
      normalizedEmail !== undefined && normalizedEmail !== user.email;

    const verifyCurrentPassword = async (): Promise<void> => {
      if (!currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      if (!user.password) {
        throw new BadRequestException('This account has no password set');
      }
      const isMatch = await comparePassword(currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('Current password is incorrect');
      }
    };

    if (isChangingEmail) {
      await verifyCurrentPassword();
      updatedData.email = normalizedEmail;
    }

    if (newPassword) {
      await verifyCurrentPassword();
      updatedData.password = await hashPassword(newPassword);
    }

    if (Object.keys(updatedData).length === 0) {
      return user.toJSON() as UserResponseDto;
    }

    try {
      const updated = await this.userModel.findByIdAndUpdate(id, updatedData, {
        new: true,
      });

      if (!updated) {
        throw new NotFoundException('User not found');
      }

      this.logger.log(`User ${id} updated their own information`);
      return updated.toJSON() as UserResponseDto;
    } catch (error: unknown) {
      const mongoError = error as { code?: number };
      if (mongoError?.code === 11000) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async updateAdmin(
    id: string,
    dto: UpdateUserAdminDto,
    currentUserId: string,
  ): Promise<UserResponseDto> {
    if (id === currentUserId) {
      this.logger.warn(`Admin ${currentUserId} tried to change their own role`);
      throw new ForbiddenException('Admins cannot change their own role');
    }

    const user = await this.userModel.findByIdAndUpdate(
      id,
      { role: dto.role },
      { new: true },
    );

    if (!user) {
      this.logger.warn(`Admin update failed: user ${id} not found`);
      throw new NotFoundException('User not found');
    }

    this.logger.log(
      `User ${id} role updated to ${dto.role} by admin ${currentUserId}`,
    );
    return user.toJSON() as UserResponseDto;
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userModel.findByIdAndDelete(id);

    if (!user) {
      this.logger.warn(`Delete failed: user ${id} not found`);
      throw new NotFoundException('user not found');
    }

    this.logger.log(`User ${id} deleted`);

    return { message: 'user deleted' };
  }
}
