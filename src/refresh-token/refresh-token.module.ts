import { Module } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  RefreshTokenSchema,
} from 'src/schemas/refreshToken.schema';

@Module({
  providers: [RefreshTokenService],
  exports: [RefreshTokenService, MongooseModule],
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],
})
export class RefreshTokenModule {}
