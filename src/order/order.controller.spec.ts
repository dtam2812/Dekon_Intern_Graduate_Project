import { Test, TestingModule } from '@nestjs/testing';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from 'src/guard/auth.guard';
import { RolesGuard } from 'src/guard/role.guard';
import { PaymentMethod } from 'src/enum/paymentMethod.enum';
import { OrderStatus } from 'src/enum/orderStatus.enum';
import { PaymentStatus } from 'src/enum/paymentStatus.enum';
import request from 'supertest';
import { UserRole } from 'src/enum/userRole.enum';
import { TransformInterceptor } from 'src/interceptor/transform.interceptor';

interface RequestWithUser {
  user?: { sub?: string; role: UserRole };
}

describe('OrderController', () => {
  let controller: OrderController;
  let app: INestApplication;

  const mockOrderService = {
    create: jest.fn(),
    confirmOrder: jest.fn(),
    cancelOrder: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOrdersByCustomer: jest.fn(),
    updatePaymentStatus: jest.fn(),
    updateOrderStatus: jest.fn(),
    updateShippingAddress: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<RequestWithUser>();
      req.user = { sub: 'mockUserId', role: UserRole.ADMIN };
      return true;
    },
  };
  const mockRolesGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    mockRolesGuard.canActivate.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: mockOrderService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<OrderController>(OrderController);
    app = module.createNestApplication();
    app.useGlobalGuards(mockAuthGuard, mockRolesGuard);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await app.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /order', () => {
    const id = '507f1f77bcf86cd799439011';
    const dto = {
      items: [{ productId: id, quantity: 2 }],
      paymentMethod: PaymentMethod.BANKING,
      receiverName: 'Tam Dinh',
      receiverPhone: '0901234567',
      shippingAddress: {
        houseNumber: '1',
        street: 'Le Loi',
        ward: 'Ben Nghe',
        district: 'District 1',
        city: 'Ho Chi Minh City',
        country: 'Vietnam',
      },
    };
    it('should return 201 and create an order', async () => {
      const result = {
        userId: id,
        total: 200,
        status: OrderStatus.PENDING,
        paymentMethod: dto.paymentMethod,
        paymentStatus: PaymentStatus.UNPAID,

        receiverName: dto.receiverName,
        receiverPhone: dto.receiverPhone,
        shippingAddress: dto.shippingAddress,
        orderItems: dto.items,
        orderStatusHistory: [
          {
            changedBy: id,
            status: OrderStatus.PENDING,
            changedAt: '2026-09-29T08:31:50.685Z',
          },
        ],
      };
      mockOrderService.create.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/order')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.create).toHaveBeenCalledWith('mockUserId', dto);
    });

    it('should return 400 if order items is empty', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, items: [] })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, receiverName: undefined })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if a required field is missing', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, receiverName: undefined })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if shippingAddress is missing', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, shippingAddress: undefined })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if a shippingAddress field is empty', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, shippingAddress: { ...dto.shippingAddress, city: '' } })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if receiverPhone is not a valid VN phone number', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, receiverPhone: '12345' })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if quantity is less than 1', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, items: [{ productId: id, quantity: 0 }] })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if productId is not a valid id', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({ ...dto, items: [{ productId: 'invalid', quantity: 1 }] })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 400 if items contain duplicate productId', async () => {
      await request(app.getHttpServer())
        .post('/order')
        .send({
          ...dto,
          items: [
            { productId: id, quantity: 1 },
            { productId: id, quantity: 2 },
          ],
        })
        .expect(400);

      expect(mockOrderService.create).not.toHaveBeenCalled();
    });

    it('should return 404 if a product does not exist', async () => {
      mockOrderService.create.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await request(app.getHttpServer()).post('/order').send(dto).expect(404);
    });

    it('should return 400 if stock is insufficient', async () => {
      mockOrderService.create.mockRejectedValue(
        new BadRequestException('Product insufficient stock'),
      );

      await request(app.getHttpServer()).post('/order').send(dto).expect(400);
    });
  });

  describe('POST /order/confirm', () => {
    const dto = {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30',
    };
    it('should return 201 and confirm the order', async () => {
      const result = { id: 'order1', status: OrderStatus.CONFIRMED };
      mockOrderService.confirmOrder.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/order/confirm')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.confirmOrder).toHaveBeenCalledWith(dto);
    });

    it('should return 400 if token invalid or expired ', async () => {
      mockOrderService.confirmOrder.mockRejectedValue(
        new BadRequestException('Token invalid'),
      );

      await request(app.getHttpServer())
        .post('/order/confirm')
        .send(dto)
        .expect(400);
    });

    it('should return 404 if order not found or already processed', async () => {
      mockOrderService.confirmOrder.mockRejectedValue(
        new NotFoundException('Order not found or already processed'),
      );

      await request(app.getHttpServer())
        .post('/order/confirm')
        .send(dto)
        .expect(404);
    });
  });

  describe('POST /order/cancel', () => {
    const dto = {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30',
    };
    it('should return 201 and cancel the order', async () => {
      const result = { id: 'order1', status: OrderStatus.CANCELLED };
      mockOrderService.cancelOrder.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .post('/order/cancel')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(dto);
    });

    it('should return 400 if token invalid or expired ', async () => {
      mockOrderService.cancelOrder.mockRejectedValue(
        new BadRequestException('Token invalid'),
      );

      await request(app.getHttpServer())
        .post('/order/cancel')
        .send(dto)
        .expect(400);
    });

    it('should return 404 if order not found or already processed', async () => {
      mockOrderService.cancelOrder.mockRejectedValue(
        new NotFoundException('Order not found or already processed'),
      );

      await request(app.getHttpServer())
        .post('/order/cancel')
        .send(dto)
        .expect(404);
    });
  });

  describe('GET /order', () => {
    it('should return 200 and orders with metadata', async () => {
      const result = {
        data: [{ id: 'order1' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      };
      mockOrderService.findAll.mockResolvedValue(result);

      const res = await request(app.getHttpServer()).get('/order').expect(200);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.findAll).toHaveBeenCalled();
    });

    it('should pass query params', async () => {
      mockOrderService.findAll.mockResolvedValue({ data: [], meta: {} });
      const query = {
        page: 2,
        itemsPerPage: 5,
        search: 'jeans',
        userId: '507f1f77bcf86cd799439011',
      };

      await request(app.getHttpServer()).get('/order').query(query).expect(200);

      expect(mockOrderService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('GET /order/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should return 200 and an order', async () => {
      const result = { id, status: OrderStatus.PENDING };
      mockOrderService.findOne.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get(`/order/${id}`)
        .expect(200);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.findOne).toHaveBeenCalledWith(id, {
        userId: 'mockUserId',
        role: UserRole.ADMIN,
      });
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';

      await request(app.getHttpServer()).get(`/order/${invalidId}`).expect(400);

      expect(mockOrderService.findOne).not.toHaveBeenCalled();
    });

    it('should return 404 if order does not exist', async () => {
      mockOrderService.findOne.mockRejectedValue(
        new NotFoundException('Order not found'),
      );
      await request(app.getHttpServer()).get(`/order/${id}`).expect(404);

      expect(mockOrderService.findOne).toHaveBeenCalledWith(id, {
        userId: 'mockUserId',
        role: UserRole.ADMIN,
      });
    });

    it('should return 403 if the order belongs to another user', async () => {
      mockOrderService.findOne.mockRejectedValue(
        new ForbiddenException('You do not have access to this order'),
      );

      await request(app.getHttpServer()).get(`/order/${id}`).expect(403);
    });
  });

  describe('GET /order/byCustomerId', () => {
    it("should return 200 and current user's orders", async () => {
      const result = [{ id: 'order1' }, { id: 'order2' }];
      mockOrderService.findOrdersByCustomer.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get('/order/byCustomer')
        .expect(200);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.findOrdersByCustomer).toHaveBeenCalledWith(
        'mockUserId',
      );
    });
  });

  describe('PATCH /order/updatePaymentStatus/:id', () => {
    const id = '507f1f77bcf86cd799439011';
    it('should return 200 and mark the order as paid', async () => {
      const result = { id, paymentStatus: PaymentStatus.PAID };
      mockOrderService.updatePaymentStatus.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch(`/order/updatePaymentStatus/${id}`)
        .expect(200);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.updatePaymentStatus).toHaveBeenCalledWith(id, {
        sub: 'mockUserId',
        role: 'admin',
      });
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .patch(`/order/updatePaymentStatus/${invalidId}`)
        .expect(400);

      expect(mockOrderService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it("should return 403 if user's role is not admin or staff", async () => {
      mockRolesGuard.canActivate.mockReturnValueOnce(false);

      await request(app.getHttpServer())
        .patch(`/order/updatePaymentStatus/${id}`)
        .expect(403);

      expect(mockOrderService.updatePaymentStatus).not.toHaveBeenCalled();
    });

    it('should return 404 if order not found', async () => {
      mockOrderService.updatePaymentStatus.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await request(app.getHttpServer())
        .patch(`/order/updatePaymentStatus/${id}`)
        .expect(404);
    });

    it('should return 400 if order is already paid or cancelled', async () => {
      mockOrderService.updatePaymentStatus.mockRejectedValue(
        new BadRequestException('Order is already marked as paid'),
      );

      await request(app.getHttpServer())
        .patch(`/order/updatePaymentStatus/${id}`)
        .expect(400);
    });
  });

  describe('PATCH /order/:id', () => {
    const dto = { newStatus: OrderStatus.CONFIRMED };
    const id = '507f1f77bcf86cd799439011';

    it('should return 200 and update the order status', async () => {
      const result = { id, status: OrderStatus.CONFIRMED };
      mockOrderService.updateOrderStatus.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch(`/order/${id}`)
        .send(dto)
        .expect(200);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
        id,
        dto,
        'mockUserId',
      );
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .patch(`/order/${invalidId}`)
        .send(dto)
        .expect(400);

      expect(mockOrderService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('should return 400 if newStatus is not a valid status', async () => {
      await request(app.getHttpServer())
        .patch(`/order/${id}`)
        .send({ newStatus: 'not-a-status' })
        .expect(400);

      expect(mockOrderService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it("should return 403 if user'role is not admin or staff", async () => {
      mockRolesGuard.canActivate.mockReturnValueOnce(false);

      await request(app.getHttpServer())
        .patch(`/order/${id}`)
        .send(dto)
        .expect(403);

      expect(mockOrderService.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('should return 404 if order not found', async () => {
      mockOrderService.updateOrderStatus.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await request(app.getHttpServer())
        .patch(`/order/${id}`)
        .send(dto)
        .expect(404);
    });

    it('should return 400 if the status transition is not allowed', async () => {
      mockOrderService.updateOrderStatus.mockRejectedValue(
        new BadRequestException(
          'Cannot change order status from "completed" to "confirmed"',
        ),
      );

      await request(app.getHttpServer())
        .patch(`/order/${id}`)
        .send(dto)
        .expect(400);
    });

    it('should return 409 if the order status was changed by someone else', async () => {
      mockOrderService.updateOrderStatus.mockRejectedValue(
        new ConflictException(
          'Order status was changed by someone else, please reload and try again',
        ),
      );

      await request(app.getHttpServer())
        .patch(`/order/${id}`)
        .send(dto)
        .expect(409);
    });
  });

  describe('PATCH /order/shippingAddress/:id', () => {
    const dto = {
      houseNumber: '1A',
      street: 'Nguyen Hue',
      ward: 'Ben Nghe',
      district: '1',
      city: 'HCM',
      country: 'VietNam',
      note: 'Giao buoi sang',
    };
    const id = '507f1f77bcf86cd799439011';

    it("should return 200 and update the order's shipping address", async () => {
      const result = {
        id,
        status: OrderStatus.CONFIRMED,
        shippingAddress: dto,
      };
      mockOrderService.updateShippingAddress.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .patch(`/order/shippingAddress/${id}`)
        .send(dto)
        .expect(200);

      expect(res.body).toEqual({ data: result });
      expect(mockOrderService.updateShippingAddress).toHaveBeenCalledWith(
        id,
        dto,
        'mockUserId',
      );
    });

    it('should return 400 if id is invalid', async () => {
      const invalidId = 'invalid';
      await request(app.getHttpServer())
        .patch(`/order/shippingAddress/${invalidId}`)
        .send(dto)
        .expect(400);

      expect(mockOrderService.updateShippingAddress).not.toHaveBeenCalled();
    });

    it('should return 404 if the order does not exist', async () => {
      mockOrderService.updateShippingAddress.mockRejectedValue(
        new NotFoundException('Order not found'),
      );

      await request(app.getHttpServer())
        .patch(`/order/shippingAddress/${id}`)
        .send(dto)
        .expect(404);
    });

    it('should return 409 if the order is already being shipped', async () => {
      mockOrderService.updateShippingAddress.mockRejectedValue(
        new ConflictException(
          'Order is being shipped, shipping address cannot be changed',
        ),
      );

      await request(app.getHttpServer())
        .patch(`/order/shippingAddress/${id}`)
        .send(dto)
        .expect(409);
    });

    it('should return 404 if the order belongs to another user', async () => {
      mockOrderService.updateShippingAddress.mockRejectedValue(
        new NotFoundException('You do not have access to this order'),
      );

      await request(app.getHttpServer())
        .patch(`/order/shippingAddress/${id}`)
        .send(dto)
        .expect(404);
    });
  });
});
