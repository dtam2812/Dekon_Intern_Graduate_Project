import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
  ) {}

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    try {
      const existedEmail = await this.userModel.findOne({ email: dto.email });

      if (existedEmail) {
        throw new ConflictException('This email has been used');
      }

      if (!dto.password) {
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

      return user.toJSON() as UserResponseDto;
    } catch (error) {
      if (error.code === 11000) {
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
      throw new NotFoundException('user not found');
    }

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
      throw new NotFoundException('user not found');
    }

    return user.toJSON() as UserResponseDto;
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.userModel.findByIdAndDelete(id);

    if (!user) {
      throw new NotFoundException('user not found');
    }

    return { message: 'user deleted' };
  }
}
