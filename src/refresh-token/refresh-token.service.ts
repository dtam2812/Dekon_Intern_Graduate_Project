import { Injectable } from '@nestjs/common';
import { CreateRefreshTokenDto } from 'src/dto/create-refreshToken.dto';

@Injectable()
export class RefreshTokenService {
  create(_createRefreshTokenDto: CreateRefreshTokenDto) {
    return 'This action adds a new refreshToken';
  }

  findAll() {
    return `This action returns all refreshToken`;
  }

  findOne(id: number) {
    return `This action returns a #${id} refreshToken`;
  }

  update(id: number, _updateRefreshTokenDto: CreateRefreshTokenDto) {
    return `This action updates a #${id} refreshToken`;
  }

  remove(id: number) {
    return `This action removes a #${id} refreshToken`;
  }
}
