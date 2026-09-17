import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from 'src/dto/create-category.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';

@Injectable()
export class AuthService {
  create(createAuthDto: CreateCategoryDto) {
    return 'This action adds a new auth';
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: CreateUserDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
