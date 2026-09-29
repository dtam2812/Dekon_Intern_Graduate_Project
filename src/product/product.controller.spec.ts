import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { RolesGuard } from 'src/guard/role.guard';
import { AuthGuard } from 'src/guard/auth.guard';

jest.mock('src/helpers/config', () => ({
  storageConfig: () => undefined,
}));

jest.mock('src/pipe/validate-image-file.pipe', () => ({
  ValidateImageFilesPipe: class {
    transform(value: unknown) {
      return value;
    }
  },
}));

jest.mock('src/filter/cleanup-uploaded-files.filter', () => {
  const { BaseExceptionFilter } = jest.requireActual('@nestjs/core');
  return { CleanupUploadedFilesFilter: class extends BaseExceptionFilter {} };
});

describe('ProductController', () => {
  let controller: ProductController;
  let app: INestApplication;

  const mockProductService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuthGuard = { canActivate: (context: ExecutionContext) => true };
  const mockRolesGuard = { canActivate: () => true };

  beforeEach(async () => {
    mockAuthGuard.canActivate = (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'mockUserId' };
      return true;
    };
    mockRolesGuard.canActivate = () => true;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: mockProductService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<ProductController>(ProductController);
    app = module.createNestApplication();
    app.useGlobalGuards(mockAuthGuard, mockRolesGuard);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await app.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /product', () => {
    const dto = {
      name: 'bootcut jeans',
      price: 100,
      categoryId: '507f1f77bcf86cd799439011',
      description: 'okeeeeeeeeee',
      slug: 'bootcut-jeans',
      stock: 0,
    };
    const image = Buffer.from('fake-image');
    it('should create new product and return 201', async () => {
      const result = { ...dto, images: ['uploads/images/image.png'] };
      mockProductService.create.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/product')
        .field('categoryId', dto.categoryId)
        .field('name', dto.name)
        .field('slug', dto.slug)
        .field('description', dto.description)
        .field('price', dto.price)
        .field('stock', dto.stock)
        .attach('images', image, 'image.png')
        .expect(201);

      expect(res.body).toEqual(result);
      expect(mockProductService.create).toHaveBeenCalledWith(
        dto,
        expect.arrayContaining([
          expect.objectContaining({ originalname: 'image.png' }),
        ]),
        'mockUserId',
      );
    });

    it('should return 400 if product has no images', async () => {
      await request(app.getHttpServer())
        .post('/product')
        .field('name', dto.name)
        .field('price', dto.price)
        .field('categoryId', dto.categoryId)
        .expect(400);

      expect(mockProductService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if file extension is not allowed', async () => {
      await request(app.getHttpServer())
        .post('/product')
        .field('categoryId', dto.categoryId)
        .field('name', dto.name)
        .field('slug', dto.slug)
        .field('description', dto.description)
        .field('price', dto.price)
        .field('stock', dto.stock)
        .attach('images', image, 'image.gif')
        .expect(400);

      expect(mockProductService.create).not.toHaveBeenCalled();
    });

    it("should return 403 if user's role is not admin", async () => {
      mockRolesGuard.canActivate = () => false;

      await request(app.getHttpServer())
        .post('/product')
        .field('name', dto.name)
        .field('price', dto.price)
        .field('categoryId', dto.categoryId)
        .attach('images', image, 'images.png')
        .expect(403);

      expect(mockProductService.create).not.toHaveBeenCalled();
    });

    it('should return 404 if category does not exist', async () => {
      mockProductService.create.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await request(app.getHttpServer())
        .post('/product')
        .field('categoryId', dto.categoryId)
        .field('name', dto.name)
        .field('slug', dto.slug)
        .field('description', dto.description)
        .field('price', dto.price)
        .field('stock', dto.stock)
        .attach('images', image, 'image.png')
        .expect(404);
    });

    it('should return 409 if product has already existed', async () => {
      mockProductService.create.mockRejectedValue(
        new ConflictException('Product has already existed'),
      );

      await request(app.getHttpServer())
        .post('/product')
        .field('categoryId', dto.categoryId)
        .field('name', dto.name)
        .field('slug', dto.slug)
        .field('description', dto.description)
        .field('price', dto.price)
        .field('stock', dto.stock)
        .attach('images', image, 'image.png')
        .expect(409);
    });
  });

  describe('GET /product', () => {
    it('should return 200 and products with metadata', async () => {
      const result = {
        data: [{ name: 'bootcut jeans' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockProductService.findAll.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get('/product')
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockProductService.findAll).toHaveBeenCalled();
    });

    it('should pass query params', async () => {
      mockProductService.findAll.mockResolvedValue({ data: [], meta: {} });
      const query = {
        page: 2,
        itemsPerPage: 5,
        search: 'jeans',
        categoryId: '507f1f77bcf86cd799439011',
      };

      await request(app.getHttpServer())
        .get('/product')
        .query(query)
        .expect(200);

      expect(mockProductService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('GET /product/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should return 200 and a product', async () => {
      const result = { name: 'bootcut jeans' };
      mockProductService.findOne.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get(`/product/${id}`)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockProductService.findOne).toHaveBeenCalledWith(id);
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';

      await request(app.getHttpServer())
        .get(`/product/${invalidId}`)
        .expect(400);

      expect(mockProductService.findOne).not.toHaveBeenCalled();
    });

    it('should return 404 if product does not exist', async () => {
      mockProductService.findOne.mockRejectedValue(
        new NotFoundException('Product not found'),
      );
      await request(app.getHttpServer()).get(`/product/${id}`).expect(404);

      expect(mockProductService.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('PATCH /product/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    const dto = { name: 'skinny jeans' };
    const image = Buffer.from('fake-image');
    it('should return 200 and update a product without images updating', async () => {
      const result = { name: 'bootcut jeans' };
      mockProductService.update.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch(`/product/${id}`)
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockProductService.update).toHaveBeenCalledWith(
        id,
        dto,
        undefined,
        'mockUserId',
      );
    });

    it('should return 200 and update a product with images updating', async () => {
      const result = { ...dto, images: ['uploads/images/image.png'] };
      mockProductService.update.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch(`/product/${id}`)
        .field('name', dto.name)
        .attach('images', image, 'image.png')
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockProductService.update).toHaveBeenCalledWith(
        id,
        dto,
        expect.arrayContaining([
          expect.objectContaining({ originalname: 'image.png' }),
        ]),
        'mockUserId',
      );
    });

    it("should return 403 if user's role is not admin", async () => {
      mockRolesGuard.canActivate = () => false;

      await request(app.getHttpServer())
        .patch(`/product/${id}`)
        .send(dto)
        .expect(403);

      expect(mockProductService.update).not.toHaveBeenCalled();
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .patch(`/product/${invalidId}`)
        .send(dto)
        .expect(400);

      expect(mockProductService.update).not.toHaveBeenCalled();
    });

    it('should return 400 if file extension is not allowed', async () => {
      await request(app.getHttpServer())
        .patch(`/product/${id}`)
        .field('name', dto.name)
        .attach('images', image, 'images.gif')
        .expect(400);

      expect(mockProductService.update).not.toHaveBeenCalled();
    });

    it('should return 404 if product is not found', async () => {
      mockProductService.update.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await request(app.getHttpServer())
        .patch(`/product/${id}`)
        .send(dto)
        .expect(404);
    });

    it('should return 409 if product has already existed', async () => {
      mockProductService.update.mockRejectedValue(
        new ConflictException('Product has already existed'),
      );

      await request(app.getHttpServer())
        .patch(`/product/${id}`)
        .send(dto)
        .expect(409);
    });
  });

  describe('DELETE /product/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should delete a product and return a message', async () => {
      const result = { message: 'product deleted' };
      mockProductService.remove.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .delete(`/product/${id}`)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockProductService.remove).toHaveBeenCalledWith(id);
    });

    it("should return 403 if user's role is not admin", async () => {
      mockRolesGuard.canActivate = () => false;

      await request(app.getHttpServer()).delete(`/product/${id}`).expect(403);

      expect(mockProductService.remove).not.toHaveBeenCalled();
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .delete(`/product/${invalidId}`)
        .expect(400);

      expect(mockProductService.remove).not.toHaveBeenCalled();
    });

    it('should return 404 if product is not found', async () => {
      mockProductService.remove.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await request(app.getHttpServer()).delete(`/product/${id}`).expect(404);
    });
  });
});
