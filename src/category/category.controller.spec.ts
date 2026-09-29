import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { AuthGuard } from 'src/guard/auth.guard';
import { RolesGuard } from 'src/guard/role.guard';

interface RequestWithUser {
  user?: { sub?: string; email?: string; fullName?: string };
}

describe('CategoryController', () => {
  let controller: CategoryController;
  let app: INestApplication;

  const mockCategoryService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<RequestWithUser>();
      req.user = { sub: 'mockUserId' };
      return true;
    },
  };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    mockRolesGuard.canActivate.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [
        { provide: CategoryService, useValue: mockCategoryService },
        Reflector,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CategoryController>(CategoryController);
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
    await app.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /category', () => {
    const dto = {
      name: 'bootcut jeans',
      slug: 'bootcut-jeans',
    };

    it('should create new category and return 201', async () => {
      const result = {
        name: 'bootcut jeans',
        slug: 'bootcut-jeans',
      };

      mockCategoryService.create.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/category')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(result);
      expect(mockCategoryService.create).toHaveBeenCalledWith(dto);
    });

    it('should return 409 if user slug has already existed', async () => {
      mockCategoryService.create.mockRejectedValue(
        new ConflictException('Slug existed'),
      );

      await request(app.getHttpServer())
        .post('/category')
        .send(dto)
        .expect(409);
      expect(mockCategoryService.create).toHaveBeenCalledWith(dto);
    });

    it('should return 403 if user role is not admin', async () => {
      mockRolesGuard.canActivate.mockReturnValueOnce(false);
      mockCategoryService.create.mockRejectedValue(
        new ForbiddenException('Role is not admin'),
      );

      await request(app.getHttpServer()).post('/category').expect(403);

      expect(mockCategoryService.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /category', () => {
    it('should return 200 and all categories', async () => {
      const result = [
        {
          name: 'bootcut jeans',
          slug: 'bootcut-jeans',
        },
      ];
      mockCategoryService.findAll.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get('/category')
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockCategoryService.findAll).toHaveBeenCalled();
    });
  });

  describe('GET /category/:id', () => {
    it('should return 200 and a category', async () => {
      const result = {
        name: 'bootcut jeans',
        slug: 'bootcut-jeans',
      };
      const id = '507f1f77bcf86cd799439011';
      mockCategoryService.findOne.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get(`/category/${id}`)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockCategoryService.findOne).toHaveBeenCalled();
    });

    it('should return 400 if id is invalid', async () => {
      const id = 'invalid';
      mockCategoryService.findOne.mockRejectedValue(
        new NotFoundException('Invalid Id'),
      );

      await request(app.getHttpServer()).get(`/category/${id}`).expect(400);

      expect(mockCategoryService.findOne).not.toHaveBeenCalled();
    });

    it('should return 404 if category does not exist', async () => {
      const id = '507f1f77bcf86cd799439011';
      mockCategoryService.findOne.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await request(app.getHttpServer()).get(`/category/${id}`).expect(404);
    });
  });

  describe('PATCH /category/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    const dto = { name: 'skinny jeans' };
    it('should return 200 and update a category', async () => {
      const result = { name: 'skinny jeans', slug: 'bootcut-jeans' };
      mockCategoryService.update.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch(`/category/${id}`)
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockCategoryService.update.mock.calls[0][0].toString()).toBe(id);
    });

    it('should return 403 if user role is not admin', async () => {
      mockRolesGuard.canActivate.mockReturnValueOnce(false);

      await request(app.getHttpServer())
        .patch(`/category/${id}`)
        .send(dto)
        .expect(403);

      expect(mockCategoryService.update).not.toHaveBeenCalled();
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .patch(`/category/${invalidId}`)
        .send(dto)
        .expect(400);

      expect(mockCategoryService.update).not.toHaveBeenCalled();
    });

    it('should return 409 if slug or name already exists', async () => {
      mockCategoryService.update.mockRejectedValue(
        new ConflictException('This slug existed'),
      );

      const res = await request(app.getHttpServer())
        .patch(`/category/${id}`)
        .send({ slug: 'existing-slug' })
        .expect(409);

      expect(res.body).toMatchObject({ message: 'This slug existed' });
    });

    it('should return 404 if category does not exist', async () => {
      mockCategoryService.update.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await request(app.getHttpServer())
        .patch(`/category/${id}`)
        .send(dto)
        .expect(404);
    });
  });

  describe('DELETE /category/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should return 200 and a success message', async () => {
      const result = { message: 'Category deleted' };
      mockCategoryService.remove.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .delete(`/category/${id}`)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockCategoryService.remove.mock.calls[0][0].toString()).toBe(id);
    });

    it('should return 403 if user role is not admin', async () => {
      mockRolesGuard.canActivate.mockReturnValueOnce(false);

      await request(app.getHttpServer()).delete(`/category/${id}`).expect(403);

      expect(mockCategoryService.remove).not.toHaveBeenCalled();
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .delete(`/category/${invalidId}`)
        .expect(400);

      expect(mockCategoryService.remove).not.toHaveBeenCalled();
    });

    it('should return 404 if category does not exist', async () => {
      mockCategoryService.remove.mockRejectedValue(
        new NotFoundException('Category not found'),
      );

      await request(app.getHttpServer()).delete(`/category/${id}`).expect(404);
    });
  });
});
