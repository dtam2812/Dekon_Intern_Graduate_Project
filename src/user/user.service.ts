import {
  BadRequestException,
  ConflictException,
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
import { hashPassword } from 'src/service/PasswordHashing';

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
        email: dto.email,
        password: hashedPassword,
        role: dto.role,
        provider: AuthProvider.LOCAL,
      });

      this.logger.log(
        `User ${user._id.toString()} created with role ${dto.role}`,
      );

      return user.toJSON() as UserResponseDto;
    } catch (error) {
      if (error.code === 11000) {
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

  async update(
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto | null> {
    const updatedData: Partial<UpdateUserDto> = { ...dto };

    if (dto.password) {
      updatedData.password = await hashPassword(dto.password);
    }

    const user = await this.userModel.findByIdAndUpdate(id, updatedData, {
      new: true,
    });

    if (!user) {
      this.logger.warn(`Update failed: user ${id} not found`);
      throw new NotFoundException('user not found');
    }

    this.logger.log(`User ${id} updated their own information`);

    return user.toJSON() as UserResponseDto;
  }

  async updateAdmin(
    id: string,
    dto: UpdateUserAdminDto,
  ): Promise<UserResponseDto | null> {
    const updatedData: Partial<UpdateUserAdminDto> = { ...dto };

    if (dto.password) {
      updatedData.password = await hashPassword(dto.password);
    }

    const user = await this.userModel.findByIdAndUpdate(id, updatedData, {
      new: true,
    });

    if (!user) {
      this.logger.warn(`Admin update failed: user ${id} not found`);
      throw new NotFoundException('user not found');
    }

    this.logger.log(`User ${id} updated by admin`);

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
