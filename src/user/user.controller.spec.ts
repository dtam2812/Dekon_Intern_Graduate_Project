import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/guard/role.guard';
import request from 'supertest';

describe('UserController', () => {
  let controller: UserController;
  let app: INestApplication;

  const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateAdmin: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuthGuard = { canActivate: () => true };
  const mockRolesGuard = { canActivate: () => true };

  beforeEach(async () => {
    mockAuthGuard.canActivate = (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'mockUserId' };
      return true;
    };
    mockRolesGuard.canActivate = () => true;
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        Reflector,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<UserController>(UserController);
    app = module.createNestApplication();
    app.useGlobalGuards(mockAuthGuard, mockRolesGuard);
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

  describe('POST /user', () => {
    it('should create user and return 201', async () => {
      const dto = {
        fullName: 'abcd',
        email: 'tam@gmail.com',
        password: '12345',
        role: 'admin',
        provider: 'local',
      };

      const result = {
        id: '1',
        fullName: dto.fullName,
        email: dto.email,
        role: dto.role,
        provider: dto.provider,
      };
      mockUserService.create.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/user')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(result);
      expect(mockUserService.create).toHaveBeenCalledWith(dto);
    });

    it('should return 403 if RolesGuard rejects(not Admin)', async () => {
      mockRolesGuard.canActivate = () => false;
      await request(app.getHttpServer())
        .post('/user')
        .send({ email: 'tam@gmail.com', password: '123456' })
        .expect(403);

      expect(mockUserService.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /user', () => {
    it('should return 200 and a list of user ', async () => {
      const users = [
        {
          id: '1',
          email: 'tam@gmail.com',
          fullName: 'tam',
          role: 'customer',
        },
      ];
      mockUserService.findAll.mockResolvedValue(users);
      const res = await request(app.getHttpServer()).get('/user').expect(200);

      expect(res.body).toEqual(users);
      expect(mockUserService.findAll).toHaveBeenCalled();
    });

    it('should return 403 if RolesGuard rejects(not Admin or Staff)', async () => {
      mockRolesGuard.canActivate = () => false;
      await request(app.getHttpServer()).get(`/user`).expect(403);

      expect(mockUserService.findAll).not.toHaveBeenCalled();
    });
  });

  describe('GET /user/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should return 200 and a user', async () => {
      const user = {
        id: '507f1f77bcf86cd799439011',
        email: 'tam@gamil.com',
        fullName: 'tam dinh',
        role: 'customer',
      };
      mockUserService.findOne.mockResolvedValue(user);

      const res = await request(app.getHttpServer())
        .get(`/user/${user.id}`)
        .expect(200);

      expect(res.body).toEqual(user);
      expect(mockUserService.findOne).toHaveBeenCalledWith(id);
    });

    it('should return 400 if id is not a valid ObjectId', async () => {
      await request(app.getHttpServer())
        .get('/user/not-a-valid-id')
        .expect(400);

      expect(mockUserService.findOne).not.toHaveBeenCalled();
    });

    it('should return 403 if RolesGuard rejects(not Admin or Staff)', async () => {
      mockRolesGuard.canActivate = () => false;
      await request(app.getHttpServer()).get(`/user/${id}`).expect(403);

      expect(mockUserService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /user/updateInfo', () => {
    const dto = {
      fullName: 'abcd',
      email: 'tam@gmail.com',
      password: '12345',
    };
    const id = '507f1f77bcf86cd799439011';
    it("should return 200 and update a user's information", async () => {
      const result = {
        _id: id,
        userName: 'Updated Name',
        email: 'a@test.com',
      };
      mockUserService.update.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch('/user/updateInfo')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockUserService.update).toHaveBeenCalledWith('mockUserId', dto);
    });
  });

  describe('PATCH /user/:id', () => {
    const dto = {
      fullName: 'abcd',
      email: 'tam@gmail.com',
      password: '12345',
      role: 'customer',
    };
    const id = '507f1f77bcf86cd799439011';

    it("should return 200 and update a user info (admin's action)", async () => {
      const result = {
        fullName: 'abcd',
        email: 'tam@gmail.com',
        password: '12345',
        role: 'customer',
      };
      mockUserService.updateAdmin.mockResolvedValue(dto);

      const res = await request(app.getHttpServer())
        .patch(`/user/${id}`)
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockUserService.updateAdmin).toHaveBeenCalledWith(id, dto);
    });

    it('should return 404 if user to update not found', async () => {
      mockUserService.updateAdmin.mockRejectedValue(
        new NotFoundException(`User with id ${id} not found`),
      );

      await request(app.getHttpServer())
        .patch(`/user/${id}`)
        .send(dto)
        .expect(404);

      expect(mockUserService.updateAdmin).toHaveBeenCalledWith(id, dto);
    });

    it('should return 403 if RolesGuard rejects(not Admin or Staff)', async () => {
      mockRolesGuard.canActivate = () => false;
      await request(app.getHttpServer())
        .patch(`/user/${id}`)
        .send(dto)
        .expect(403);

      expect(mockUserService.updateAdmin).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /user/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should delete a user and return a message', async () => {
      const result = { message: 'delete user successfully' };
      mockUserService.remove.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .delete(`/user/${id}`)
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockUserService.remove).toHaveBeenCalledWith(id);
    });

    it('should return 404 if user to update not found', async () => {
      mockUserService.remove.mockRejectedValue(
        new NotFoundException(`User with id ${id} not found`),
      );

      await request(app.getHttpServer()).delete(`/user/${id}`).expect(404);

      expect(mockUserService.remove).toHaveBeenCalledWith(id);
    });

    it('should return 403 if RolesGuard rejects(not Admin or Staff)', async () => {
      mockRolesGuard.canActivate = () => false;
      await request(app.getHttpServer()).delete(`/user/${id}`).expect(403);

      expect(mockUserService.remove).not.toHaveBeenCalled();
    });
  });
});
