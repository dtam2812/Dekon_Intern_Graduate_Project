import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { TransformInterceptor } from './interceptor/transform.interceptor';
import { CatchEverythingFilter } from './filter/catch.filter';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
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
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new CatchEverythingFilter(httpAdapter));
  app.useLogger(app.get(Logger));

  const config = new DocumentBuilder()
    .setTitle('E-commerce API')
    .setDescription(
      `Backend API for a sales website (internship project at DEKON).

**Roles:** Guest, Customer, Staff (update order status/payment), Admin (full rights, manages products).

**Authentication:** call \`POST /auth/login\` or \`POST /auth/google\`, copy the access token, click **Authorize** and paste it. Use the refresh token endpoint when the access token expires.
`,
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addTag('Auth', 'Register, Login, Logout,Rrefresh token, Google OAuth')
    .addTag(
      'User',
      'Create, Update, Delete, Update user for admin, Find all users, Find user by id',
    )
    .addTag(
      'Category',
      'Create, Update, Delete, Find all categories, Find category by id',
    )
    .addTag(
      'Product',
      'Create, Update, Delete, Find all products, Find product by id',
    )
    .addTag(
      'Order',
      "Create, Confirm order, Cancel order, Get all orders, Get order by id, Update order's status, Get orders by customer, Update order's payment status, Update shipping address",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
