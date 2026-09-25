import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RefreshTokenModule } from './refresh-token/refresh-token.module';
import { OrderModule } from './order/order.module';
import { ProductModule } from './product/product.module';
import { CategoryModule } from './category/category.module';
import { UserModule } from './user/user.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './guard/auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './guard/role.guard';
import { MailerModule } from '@nestjs-modules/mailer';
import { PugAdapter } from '@nestjs-modules/mailer/adapters/pug.adapter';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UserModule,
    OrderModule,
    ProductModule,
    CategoryModule,
    RefreshTokenModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI!),
    AuthModule,
    LoggerModule.forRoot(),
    MailerModule.forRootAsync({
      useFactory: () => {
        const port = Number(process.env.SMTP_PORT ?? 587);

        return {
          transport: {
            host: process.env.SMTP_HOST,
            port,
            secure: port === 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 10000,
          },
          defaults: { from: process.env.SMTP_FROM },
          template: {
            dir: join(__dirname, 'pug'),
            adapter: new PugAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
