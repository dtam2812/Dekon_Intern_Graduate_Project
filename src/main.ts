import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { TransformInterceptor } from './interceptor/transform.interceptor';
import { CatchEverythingFilter } from './filter/catch.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI!,
        collectionName: 'sessions',
        ttl: 5 * 60,
      }),
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
      },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new CatchEverythingFilter(httpAdapter));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
