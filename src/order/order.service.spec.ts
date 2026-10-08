import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { OrderService } from './order.service';
import { OrderStatus } from 'src/enum/orderStatus.enum';
import { ShippingAddress } from 'src/schemas/shippingAddress.schema';
import { PaymentMethod } from 'src/enum/paymentMethod.enum';
import { PaymentStatus } from 'src/enum/paymentStatus.enum';
import { OrderItem } from 'src/schemas/orderItem.schema';
import { OrderStatusHistory } from 'src/schemas/orderStatusHistory.schema';
import { Order } from 'src/schemas/order.schema';
import { User } from 'src/schemas/user.schema';
import { Product } from 'src/schemas/product.schema';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from 'src/enum/userRole.enum';

describe('OrderService', () => {
  let service: OrderService;

  const mockOrderModel = {
    db: { startSession: jest.fn() },
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  const mockProductModel = {
    updateOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findById: jest.fn(),
  };

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockLogger = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

  const mockSession = {
    withTransaction: jest.fn(),
    endSession: jest.fn(),
  };

  // find(filter).skip(n).limit(n)
  const mockFindChain = (value) => {
    const limit = jest.fn().mockResolvedValue(value);
    const skip = jest.fn().mockReturnValue({ limit });
    mockOrderModel.find.mockReturnValue({ skip });
    return { skip, limit };
  };

  // findById(id).populate(...).populate(...)
  const mockFindByIdPopulateChain = (value) => {
    const secondPopulate = jest.fn().mockResolvedValue(value);
    const firstPopulate = jest
      .fn()
      .mockReturnValue({ populate: secondPopulate });
    mockOrderModel.findById.mockReturnValue({ populate: firstPopulate });
    return { firstPopulate, secondPopulate };
  };

  // userModel.findById(id).select('email fullName')
  const mockCustomerSelectChain = (value) => {
    const select = jest.fn().mockResolvedValue(value);
    mockUserModel.findById.mockReturnValue({ select });
    return { select };
  };

  const orderId = '507f1f77bcf86cd799439011';
  const productId = '507f1f77bcf86cd799439022';
  const userId = '507f1f77bcf86cd799439033';
  const adminId = '507f1f77bcf86cd799439044';
  const orderCode = orderId.slice(-8).toUpperCase();

  const customer = { email: 'tam@example.com', fullName: 'Tam Dinh' };

  const shippingAddress = {
    houseNumber: '1',
    street: 'Le Loi',
    ward: 'Ben Nghe',
    district: 'District 1',
    city: 'Ho Chi Minh City',
    country: 'Vietnam',
  };

  let orderResponse: {
    id: string;
    userId: string;
    total: number;
    status: OrderStatus;
    shippingAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    receiverName: string;
    receiverPhone: string;
    paymentStatus: PaymentStatus;
    orderItems: OrderItem[];
    orderStatusHistory: OrderStatusHistory[];
  };

  let mockOrder: {
    _id: Types.ObjectId;
    id: string;
    userId: string;
    total: number;
    status: OrderStatus;
    shippingAddress: ShippingAddress;
    paymentMethod: PaymentMethod;
    receiverName: string;
    receiverPhone: string;
    paymentStatus: PaymentStatus;
    orderItems: OrderItem[];
    orderStatusHistory: OrderStatusHistory[];
    $session: jest.Mock;
    toJSON: () => typeof orderResponse;
  };

  const orderWith = (overrides: Record<string, unknown>) => ({
    ...mockOrder,
    ...overrides,
  });

  beforeAll(() => {
    process.env.SMTP_FROM = 'shop@example.com';
    process.env.ORDER_TOKEN_SECRET = 'test-secret';
    process.env.SHOP_NAME = 'SneakShop';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  beforeEach(async () => {
    orderResponse = {
      id: orderId,
      userId: userId,
      total: 2000000,
      status: OrderStatus.PENDING,
      shippingAddress: {
        houseNumber: '1A',
        street: 'Nguyen Hue',
        ward: 'Ben Nghe',
        district: '1',
        city: 'HCM',
        country: 'VietNam',
        note: 'Giao buoi sang',
      },
      paymentMethod: PaymentMethod.BANKING,
      receiverName: 'Tam Dinh',
      receiverPhone: '0987654321',
      paymentStatus: PaymentStatus.UNPAID,
      orderItems: [
        {
          productId: new Types.ObjectId(productId),
          productName: 'jeans bootcut whenever',
          orderedPrice: 1000000,
          quantity: 2,
        },
      ],
      orderStatusHistory: [
        {
          changedBy: new Types.ObjectId(adminId),
          status: OrderStatus.CANCELLED,
          changedAt: new Date(),
        },
      ],
    };

    mockOrder = {
      _id: new Types.ObjectId(orderId),
      id: orderId,
      userId: userId,
      total: 2000000,
      status: OrderStatus.PENDING,
      shippingAddress: {
        houseNumber: '1A',
        street: 'Nguyen Hue',
        ward: 'Ben Nghe',
        district: '1',
        city: 'HCM',
        country: 'VietNam',
        note: 'Giao buoi sang',
      },
      paymentMethod: PaymentMethod.BANKING,
      receiverName: 'Tam Dinh',
      receiverPhone: '0987654321',
      paymentStatus: PaymentStatus.UNPAID,
      orderItems: [
        {
          productId: new Types.ObjectId(productId),
          productName: 'jeans bootcut whenever',
          orderedPrice: 1000000,
          quantity: 2,
        },
      ],
      orderStatusHistory: [
        {
          changedBy: new Types.ObjectId(adminId),
          status: OrderStatus.CANCELLED,
          changedAt: new Date(),
        },
      ],
      $session: jest.fn().mockReturnThis(),
      toJSON: () => orderResponse,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);

    mockSession.withTransaction.mockImplementation((fn: () => unknown) => fn());
    mockSession.endSession.mockResolvedValue(undefined);
    mockOrderModel.db.startSession.mockResolvedValue(mockSession);
    mockMailerService.sendMail.mockResolvedValue({ messageId: 'msg-1' });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Check stock', () => {
    it('should return true if stock is enough', async () => {
      mockProductModel.findById.mockResolvedValue({ stock: 5 });

      const result = await service['checkStock'](productId, 5);

      expect(mockProductModel.findById).toHaveBeenCalledWith(productId);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockProductModel.findById.mockResolvedValue(null);

      await expect(service['checkStock'](productId, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      mockProductModel.findById.mockResolvedValue({ stock: 1 });

      await expect(service['checkStock'](productId, 2)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Send email', () => {
    const params = {
      to: 'a@b.com',
      subject: 'Hello',
      template: 'tpl',
      context: { foo: 'bar' },
    };
    it('should send mail with SMTP FROM ', async () => {
      await service.sendEmail(params);

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        ...params,
        from: 'shop@example.com',
      });
    });

    it('should swallow and log the error if sending fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('smtp down'));

      await expect(service.sendEmail(params)).resolves.toBeUndefined();
    });
  });

  describe('Order token', () => {
    it('should sign a token with the order secret and 2d expiry', async () => {
      mockJwtService.signAsync.mockResolvedValue('signed');

      const result = await service['signOrderToken'](orderId, userId);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { orderId, userId },
        { secret: 'test-secret', expiresIn: '2d' },
      );
      expect(result).toBe('signed');
    });

    it('should return the payload of a valid token', async () => {
      mockJwtService.verify.mockReturnValue({ orderId, userId });

      const result = await service['verifyOrderToken']('token');

      expect(mockJwtService.verify).toHaveBeenCalledWith('token', {
        secret: 'test-secret',
      });
      expect(result).toEqual({ orderId, userId });
    });

    it('should throw BadRequestException if token is invalid or expired', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service['verifyOrderToken']('token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Create order', () => {
    const dto = {
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      paymentMethod: PaymentMethod.BANKING,
      receiverName: 'Tam Dinh',
      receiverPhone: '0901234567',
      shippingAddress,
    };

    const mockCreateSuccess = () => {
      mockProductModel.findById.mockResolvedValue({ stock: 100 });
      mockProductModel.findOneAndUpdate
        .mockResolvedValueOnce({ _id: 'p1', name: 'Shoe A', price: 100 })
        .mockResolvedValueOnce({ _id: 'p2', name: 'Shoe B', price: 50 });
      mockOrderModel.create.mockResolvedValue([mockOrder]);
      mockUserModel.findById.mockResolvedValue(customer);
      mockJwtService.signAsync.mockResolvedValue('signed-token');
    };

    it('should create an order, decrease stock and send confirmation email', async () => {
      mockCreateSuccess();
      const result = await service.create(userId, dto);

      expect(mockProductModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'p1', stock: { $gte: 2 } },
        { $inc: { stock: -2 } },
        { session: mockSession, new: true },
      );
      expect(mockProductModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'p2', stock: { $gte: 1 } },
        { $inc: { stock: -1 } },
        { session: mockSession, new: true },
      );
      expect(mockOrderModel.create).toHaveBeenCalledWith(
        [
          {
            userId,
            total: 250,
            status: OrderStatus.PENDING,
            paymentMethod: dto.paymentMethod,
            paymentStatus: PaymentStatus.UNPAID,
            receiverName: dto.receiverName,
            receiverPhone: dto.receiverPhone,
            shippingAddress: dto.shippingAddress,
            orderItems: [
              {
                productId: 'p1',
                productName: 'Shoe A',
                orderedPrice: 100,
                quantity: 2,
              },
              {
                productId: 'p2',
                productName: 'Shoe B',
                orderedPrice: 50,
                quantity: 1,
              },
            ],
            orderStatusHistory: [
              {
                changedBy: userId,
                status: OrderStatus.PENDING,
                changedAt: expect.any(Date),
              },
            ],
          },
        ],
        { session: mockSession },
      );
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { orderId, userId },
        expect.any(Object),
      );
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: customer.email,
          subject: 'Confirm your order',
          template: 'confirm-order',
          context: expect.objectContaining({
            name: customer.fullName,
            shopName: 'SneakShop',
            confirmLink:
              'http://localhost:3000/orders/confirm?token=signed-token',
            cancelLink:
              'http://localhost:3000/orders/cancel?token=signed-token',
          }),
        }),
      );
      expect(result).toEqual(orderResponse);
    });

    it('should return the order if sending email fails', async () => {
      mockCreateSuccess();
      mockMailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      const result = await service.create(userId, dto);

      expect(result).toEqual(orderResponse);
    });

    it('should throw NotFoundException if product not found and not start transaction', async () => {
      mockProductModel.findById.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockOrderModel.db.startSession).not.toHaveBeenCalled();
      expect(mockOrderModel.create).not.toHaveBeenCalled();
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if stock is insufficient and not start transaction', async () => {
      mockProductModel.findById.mockResolvedValue({ stock: 0 });

      await expect(service.create(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockOrderModel.db.startSession).not.toHaveBeenCalled();
      expect(mockOrderModel.create).not.toHaveBeenCalled();
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if stock runs out inside the transaction', async () => {
      mockProductModel.findById.mockResolvedValue({ stock: 10 });
      mockProductModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        'This product is out of stock',
      );
      expect(mockOrderModel.create).not.toHaveBeenCalled();
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('should end session and not send email if creating order fails', async () => {
      mockProductModel.findById.mockResolvedValue({ stock: 10 });
      mockProductModel.findOneAndUpdate.mockResolvedValue({
        _id: 'p1',
        name: 'Shoe A',
        price: 100,
      });
      mockOrderModel.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create(userId, dto)).rejects.toThrow('DB down');
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('Confirm order', () => {
    beforeEach(() => {
      mockJwtService.verify.mockReturnValue({ orderId, userId });
    });

    it('should confirm a pending order and send email', async () => {
      orderResponse.status = OrderStatus.PENDING;
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockOrder);
      mockUserModel.findById.mockResolvedValue(customer);

      const result = await service.confirmOrder('token');

      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: orderId, userId, status: OrderStatus.PENDING },
        expect.any(Array),
        { returnDocument: 'after', updatePipeline: true },
      );
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: customer.email,
          subject: `Your order #${orderCode} is confirmed`,
          template: 'order-confirmed',
        }),
      );
      expect(result).toEqual(orderResponse);
    });

    it('should throw BadRequestException if token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.confirmOrder('token')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order not found or already processed', async () => {
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.confirmOrder('token')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('Cancel order', () => {
    beforeEach(() => {
      mockJwtService.verify.mockReturnValue({ orderId, userId });
    });

    it('should cancel a pending order, restore stock and and send email', async () => {
      orderResponse.status = OrderStatus.CANCELLED;
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockOrder);
      mockProductModel.updateOne.mockResolvedValue({});
      mockUserModel.findById.mockResolvedValue(customer);

      const result = await service.cancelOrder('token');

      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: orderId,
          userId,
          status: OrderStatus.PENDING,
          paymentStatus: { $ne: PaymentStatus.PAID },
        },
        expect.objectContaining({ $set: { status: OrderStatus.CANCELLED } }),
        { new: true, session: mockSession },
      );
      expect(mockProductModel.updateOne).toHaveBeenCalledTimes(1);
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: mockOrder.orderItems[0].productId },
        { $inc: { stock: 2 } },
        { session: mockSession },
      );
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: customer.email,
          subject: `Your order #${orderCode} is cancelled`,
          template: 'order-cancelled',
        }),
      );
      expect(result).toEqual(orderResponse);
    });

    it('should throw BadRequestException if token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.cancelOrder('token')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockOrderModel.db.startSession).not.toHaveBeenCalled();
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order not found or already processed', async () => {
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.cancelOrder('token')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockProductModel.updateOne).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });
  describe('Find all', () => {
    it('should return list of orders with default pagination', async () => {
      const { skip, limit } = mockFindChain([mockOrder, mockOrder]);
      mockOrderModel.countDocuments.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(mockOrderModel.find).toHaveBeenCalledWith({});
      expect(skip).toHaveBeenCalledWith(0);
      expect(limit).toHaveBeenCalledWith(10);
      expect(mockOrderModel.countDocuments).toHaveBeenCalled();
      expect(result).toEqual({
        items: [orderResponse, orderResponse],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('should apply search, user filter and pagination', async () => {
      const { skip, limit } = mockFindChain([mockOrder, mockOrder]);
      mockOrderModel.countDocuments.mockResolvedValue(10);
      const filter = {
        receiverName: { $regex: 'tam', $options: 'i' },
        userId: userId,
      };

      const result = await service.findAll({
        search: 'tam',
        userId,
        page: 3,
        itemsPerPage: 3,
      });

      expect(mockOrderModel.find).toHaveBeenCalledWith(filter);
      expect(skip).toHaveBeenCalledWith(6);
      expect(limit).toHaveBeenCalledWith(3);
      expect(mockOrderModel.countDocuments).toHaveBeenCalledWith(filter);
      expect(result).toEqual({
        items: [orderResponse, orderResponse],
        meta: { total: 10, page: 3, limit: 3, totalPages: 4 },
      });
    });

    it('should escape regex special characters in search', async () => {
      mockFindChain([]);
      mockOrderModel.countDocuments.mockResolvedValue(0);

      await service.findAll({ search: 'a.b*' });

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        receiverName: { $regex: 'a\\.b\\*', $options: 'i' },
      });
    });

    it('should return empty data if there is no order', async () => {
      mockFindChain([]);
      mockOrderModel.countDocuments.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result).toEqual({
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
    });
  });

  describe('Find an order', () => {
    const ownedOrder = () =>
      orderWith({ userId: { _id: new Types.ObjectId(userId) } });

    it('should return an order to its owner with populated fields', async () => {
      const { firstPopulate, secondPopulate } =
        mockFindByIdPopulateChain(ownedOrder());

      const result = await service.findOne(orderId, {
        userId,
        role: 'customer',
      });

      expect(mockOrderModel.findById).toHaveBeenCalledWith(orderId);
      expect(firstPopulate).toHaveBeenCalledWith('userId', 'name email');
      expect(secondPopulate).toHaveBeenCalledWith(
        'orderStatusHistory.changedBy',
        'name role',
      );
      expect(result).toEqual(orderResponse);
    });

    it.each(['admin', 'staff'])(
      'should return any order to %s',
      async (role) => {
        mockFindByIdPopulateChain(ownedOrder());

        const result = await service.findOne(orderId, {
          userId: adminId,
          role,
        });

        expect(result).toEqual(orderResponse);
      },
    );

    it('should throw ForbiddenException if the order belongs to another customer', async () => {
      mockFindByIdPopulateChain(ownedOrder());

      await expect(
        service.findOne(orderId, { userId: adminId, role: 'customer' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Find orders by customer', () => {
    it('should return orders by customer', async () => {
      mockOrderModel.find.mockResolvedValue([mockOrder, mockOrder]);

      const result = await service.findOrdersByCustomer(userId);

      expect(mockOrderModel.find).toHaveBeenCalledWith({ userId });
      expect(result).toEqual([orderResponse, orderResponse]);
    });

    it('should return an empty array if user has no order', async () => {
      mockOrderModel.find.mockResolvedValue([]);

      const result = await service.findOrdersByCustomer(userId);

      expect(result).toEqual([]);
    });
  });

  describe('Update payment status', () => {
    const admin = { userId: adminId, role: 'admin' };

    it('should throw ForbiddenException if requester is a customer', async () => {
      await expect(
        service.updatePaymentStatus(orderId, {
          userId,
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each(['admin', 'staff'])(
      'should mark the order as paid by %s and send email',
      async (role) => {
        orderResponse.status = OrderStatus.CONFIRMED;
        mockOrderModel.findOneAndUpdate.mockResolvedValue(mockOrder);
        const { select } = mockCustomerSelectChain(customer);

        const result = await service.updatePaymentStatus(orderId, {
          userId: adminId,
          role,
        });

        expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
          {
            _id: orderId,
            status: { $ne: OrderStatus.CANCELLED },
            paymentStatus: PaymentStatus.UNPAID,
          },
          { $set: { paymentStatus: PaymentStatus.PAID } },
          { returnDocument: 'after' },
        );
        expect(select).toHaveBeenCalledWith('email fullName');
        expect(mockMailerService.sendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: customer.email,
            subject: `Payment received for order #${orderCode}`,
            template: 'order-payment-confirmed',
          }),
        );
        expect(result).toEqual(orderResponse);
      },
    );

    it('should not send email if customer not found', async () => {
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockOrder);
      mockCustomerSelectChain(null);

      await service.updatePaymentStatus(orderId, admin);

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if order not found', async () => {
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);
      mockOrderModel.findById.mockResolvedValue(null);

      await expect(service.updatePaymentStatus(orderId, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if order is cancelled', async () => {
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);
      mockOrderModel.findById.mockResolvedValue(
        orderWith({ status: OrderStatus.CANCELLED }),
      );

      await expect(service.updatePaymentStatus(orderId, admin)).rejects.toThrow(
        'Cannot update payment status for a cancelled order',
      );
    });

    it('should throw BadRequestException if order is already paid', async () => {
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);
      mockOrderModel.findById.mockResolvedValue(
        orderWith({ paymentStatus: PaymentStatus.PAID }),
      );

      await expect(service.updatePaymentStatus(orderId, admin)).rejects.toThrow(
        'Order is already marked as paid',
      );
    });
  });

  describe('Update order status', () => {
    it('should throw NotFoundException if order not found', async () => {
      mockOrderModel.findOne.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus(
          orderId,
          { newStatus: OrderStatus.CONFIRMED },
          adminId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it.each([
      [OrderStatus.PENDING, OrderStatus.SHIPPING],
      [OrderStatus.PENDING, OrderStatus.COMPLETED],
      [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED, OrderStatus.PENDING],
      [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
      [OrderStatus.COMPLETED, OrderStatus.CONFIRMED],
      [OrderStatus.CANCELLED, OrderStatus.PENDING],
    ])(
      'should throw BadRequestException for transition %s -> %s',
      async (from: OrderStatus, to: OrderStatus) => {
        mockOrderModel.findById.mockResolvedValue(orderWith({ status: from }));

        await expect(
          service.updateOrderStatus(orderId, { newStatus: to }, adminId),
        ).rejects.toThrow(BadRequestException);
        expect(mockOrderModel.db.startSession).not.toHaveBeenCalled();
      },
    );

    it('should move CONFIRMED -> SHIPPING without changing stock and send email', async () => {
      orderResponse.status = OrderStatus.SHIPPING;
      mockOrderModel.findById.mockResolvedValue(
        orderWith({ status: OrderStatus.CONFIRMED }),
      );
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockOrder);
      mockCustomerSelectChain(customer);

      const result = await service.updateOrderStatus(
        orderId,
        { newStatus: OrderStatus.SHIPPING },
        adminId,
      );

      expect(mockProductModel.updateOne).not.toHaveBeenCalled();
      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: orderId, status: OrderStatus.CONFIRMED },
        {
          $set: { status: OrderStatus.SHIPPING },
          $push: {
            orderStatusHistory: {
              changedBy: adminId,
              status: OrderStatus.SHIPPING,
              changedAt: expect.any(Date),
            },
          },
        },
        { new: true, session: mockSession },
      );
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: customer.email,
          subject: `Your order #${orderCode} is ${OrderStatus.SHIPPING}`,
          template: `order-${OrderStatus.SHIPPING.toLowerCase()}`,
        }),
      );
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(result).toEqual(orderResponse);
    });

    it('should restore stock if PENDING -> CANCELLED', async () => {
      const twoItemOrder = orderWith({
        orderItems: [
          { productId: 'p1', productName: 'A', orderedPrice: 100, quantity: 2 },
          { productId: 'p2', productName: 'B', orderedPrice: 50, quantity: 3 },
        ],
      });
      mockOrderModel.findById.mockResolvedValue(twoItemOrder);
      mockOrderModel.findOneAndUpdate.mockResolvedValue(twoItemOrder);
      mockProductModel.updateOne.mockResolvedValue({});
      mockCustomerSelectChain(customer);

      await service.updateOrderStatus(
        orderId,
        { newStatus: OrderStatus.CANCELLED },
        adminId,
      );

      expect(mockProductModel.updateOne).toHaveBeenCalledTimes(2);
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: 'p1' },
        { $inc: { stock: 2 } },
        { session: mockSession },
      );
      expect(mockProductModel.updateOne).toHaveBeenCalledWith(
        { _id: 'p2' },
        { $inc: { stock: 3 } },
        { session: mockSession },
      );
    });

    it('should set paymentStatus to PAID if SHIPPING -> COMPLETED', async () => {
      mockOrderModel.findById.mockResolvedValue(
        orderWith({ status: OrderStatus.SHIPPING }),
      );
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockOrder);
      mockCustomerSelectChain(customer);

      await service.updateOrderStatus(
        orderId,
        { newStatus: OrderStatus.COMPLETED },
        adminId,
      );

      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: orderId, status: OrderStatus.SHIPPING },
        expect.objectContaining({
          $set: {
            status: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
          },
        }),
        { new: true, session: mockSession },
      );
    });

    it('should throw ConflictException if status was changed concurrently', async () => {
      mockOrderModel.findById.mockResolvedValue(
        orderWith({ status: OrderStatus.CONFIRMED }),
      );
      mockOrderModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus(
          orderId,
          { newStatus: OrderStatus.SHIPPING },
          adminId,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Update shipping address', () => {
    const dto = {
      ...shippingAddress,
      street: 'Nguyen Hue',
    };

    let updatedResponse: typeof orderResponse;
    let mockUpdatedOrder: typeof mockOrder;

    beforeEach(() => {
      updatedResponse = { ...orderResponse, shippingAddress: dto };
      mockUpdatedOrder = {
        ...mockOrder,
        shippingAddress: dto,
        toJSON: () => updatedResponse,
      };
    });

    it('should update shipping address and send email with old and new address', async () => {
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockUpdatedOrder);
      const { select } = mockCustomerSelectChain(customer);

      const result = await service.updateShippingAddress(orderId, dto, userId);

      expect(mockOrderModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: orderId,
          userId,
          status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
        },
        { shippingAddress: dto },
        { new: true },
      );
      expect(select).toHaveBeenCalledWith('email fullName');
      expect(mockMailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: customer.email,
          subject: `Shipping address updated for order #${orderCode}`,
          template: 'shipping-address-updated',
          context: expect.objectContaining({
            order: mockUpdatedOrder,
            oldAddress: mockOrder.shippingAddress,
            newAddress: dto,
            name: customer.fullName,
            shopName: 'SneakShop',
          }),
        }),
      );
      expect(result).toEqual(updatedResponse);
    });

    it.each([OrderStatus.PENDING, OrderStatus.CONFIRMED])(
      'should update shipping address if order is %s',
      async (status) => {
        mockOrderModel.findOne.mockResolvedValue(orderWith({ status }));
        mockOrderModel.findOneAndUpdate.mockResolvedValue(mockUpdatedOrder);
        mockCustomerSelectChain(customer);

        const result = await service.updateShippingAddress(
          orderId,
          dto,
          userId,
        );

        expect(result).toEqual(updatedResponse);
      },
    );

    it('should still return the updated order if sending email fails', async () => {
      mockOrderModel.findOne.mockResolvedValue(mockOrder);
      mockOrderModel.findOneAndUpdate.mockResolvedValue(mockUpdatedOrder);
      mockCustomerSelectChain(customer);
      mockMailerService.sendMail.mockRejectedValue(new Error('smtp down'));

      const result = await service.updateShippingAddress(orderId, dto, userId);

      expect(result).toEqual(updatedResponse);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockOrderModel.findOne.mockResolvedValue(null);

      await expect(
        service.updateShippingAddress(orderId, dto, userId),
      ).rejects.toThrow(NotFoundException);
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each([
      OrderStatus.SHIPPING,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ])('should throw ConflictException if order is %s', async (status) => {
      mockOrderModel.findOne.mockResolvedValue(orderWith({ status }));

      await expect(
        service.updateShippingAddress(orderId, dto, userId),
      ).rejects.toThrow(ConflictException);
      expect(mockOrderModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
