import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { TransformInterceptor } from './interceptor/transform.interceptor';
import { CatchEverythingFilter } from './filter/catch.filter';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.set('trust proxy', 1);

  app.enableCors();

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

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

###  Demo Accounts for Reviewer:
* **Admin** (Full permissions: Products, Categories, Users):
  * **Email:** \`admin@dekon.com\` | **Password:** \`Admin@123456\`
* **Staff** (Order management, Payment status, View users):
  * **Email:** \`staff@dekon.com\` | **Password:** \`Staff@123456\`
* **Customer** (Place orders, Manage profile):
  * **Email:** \`customer@dekon.com\` | **Password:** \`Customer@123456\`

---
###  How to Authenticate & Test:
1. Scroll down to **Auth** -> **\`POST /auth/login\`** -> Click **Try it out** -> Click **Execute** (pre-filled with Admin account).
2. Copy the \`accessToken\` from the response JSON.
3. Click the **Authorize**  button at top-right of this page.
4. Paste the token into the Value field and click **Authorize**.
5. Test any Admin / Staff / Customer endpoints.
6. *(Optional)* Open Web GUI at \`http://localhost:8081\` (Mongo Express) to inspect live collections and documents (For local docker set up only).

**Note:** The seed accounts above use fake email addresses, so you will not receive emails from the Order module with them. To receive order emails, register a new account with your own email via \`GET /auth/google\` or \`POST /auth/register\`, then place an order with that account.
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
void bootstrap();
