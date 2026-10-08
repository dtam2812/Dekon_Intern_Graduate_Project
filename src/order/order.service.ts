import { ISendMailOptions, MailerService } from '@nestjs-modules/mailer';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Logger } from 'nestjs-pino';
import { ConfirmOrderTokenDto } from 'src/dto/confirm-order-token.dto';
import { CreateOrderDto, ShippingAddressDto } from 'src/dto/create-order.dto';
import { FilterOrderDto } from 'src/dto/filter-order.dto';
import { UpdateOrderStatusDto } from 'src/dto/update-order-status.dto';
import { OrderStatus } from 'src/enum/orderStatus.enum';
import { PaymentMethod } from 'src/enum/paymentMethod.enum';
import { PaymentStatus } from 'src/enum/paymentStatus.enum';
import { Order, OrderDocument } from 'src/schemas/order.schema';
import { Product, ProductDocument } from 'src/schemas/product.schema';
import { User, UserDocument } from 'src/schemas/user.schema';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly mailerService: MailerService,
    private readonly jwtService: JwtService,
    private readonly logger: Logger,
  ) {}

  private async checkStock(
    productId: string,
    quantity: number,
  ): Promise<boolean> {
    const product = await this.productModel.findById(productId);

    if (!product) {
      this.logger.warn(`Stock check failed: product ${productId} not found`);
      throw new NotFoundException('Product not found');
    }

    if (product.stock < quantity) {
      this.logger.warn(
        `Stock check failed: product ${productId} has ${product.stock}, requested ${quantity}`,
      );
      throw new BadRequestException('Product insufficient stock');
    }

    return true;
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    template: string;
    context: ISendMailOptions['context'];
  }) {
    try {
      const response = await this.mailerService.sendMail({
        to: params.to,
        from: process.env.SMTP_FROM,
        subject: params.subject,
        template: params.template,
        context: params.context,
      });
      this.logger.log(
        `Email "${params.subject}" sent (${response?.messageId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error while sending mail "${params.subject}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async signOrderToken(orderId: string, userId: string) {
    return await this.jwtService.signAsync(
      { orderId, userId },
      { secret: process.env.ORDER_TOKEN_SECRET, expiresIn: '2d' },
    );
  }

  private async verifyOrderToken(token: string) {
    try {
      return await this.jwtService.verify(token, {
        secret: process.env.ORDER_TOKEN_SECRET,
      });
    } catch {
      this.logger.warn('Order token verification failed (invalid or expired)');
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async create(customerId: string, dto: CreateOrderDto): Promise<Order> {
    this.logger.log(
      `Creating order for user ${customerId} with ${dto.items.length} item(s)`,
    );

    await Promise.all(
      dto.items.map(async (element) => {
        const enough = await this.checkStock(
          element.productId,
          element.quantity,
        );
        if (!enough) {
          throw new BadRequestException(
            `Insufficient stock for product ${element.productId}`,
          );
        }
      }),
    );

    const session = await this.orderModel.db.startSession();
    let order: OrderDocument;
    try {
      order = await session.withTransaction(async () => {
        const orderItems: {
          productId: ProductDocument['_id'];
          productName: string;
          orderedPrice: number;
          quantity: number;
        }[] = [];

        for (const element of dto.items) {
          const product = await this.productModel.findOneAndUpdate(
            {
              _id: element.productId,
              stock: { $gte: element.quantity },
            },
            { $inc: { stock: -element.quantity } },
            {
              session,
              new: true,
            },
          );

          if (!product) {
            this.logger.warn(
              `Order for user ${customerId} rejected: product ${element.productId} out of stock`,
            );
            throw new BadRequestException('This product is out of stock');
          }

          orderItems.push({
            productId: product._id,
            productName: product.name,
            orderedPrice: product.price,
            quantity: element.quantity,
          });
        }

        const total = orderItems.reduce(
          (sum, element) => sum + element.orderedPrice * element.quantity,
          0,
        );

        const [created] = await this.orderModel.create(
          [
            {
              userId: customerId,
              total,
              status: OrderStatus.PENDING,
              paymentMethod: dto.paymentMethod,
              paymentStatus: PaymentStatus.UNPAID,

              receiverName: dto.receiverName,
              receiverPhone: dto.receiverPhone,
              shippingAddress: dto.shippingAddress,
              orderItems,
              orderStatusHistory: [
                {
                  changedBy: customerId,
                  status: OrderStatus.PENDING,
                  changedAt: new Date(),
                },
              ],
            },
          ],
          { session },
        );

        return created;
      });
    } finally {
      await session.endSession();
    }

    this.logger.log(
      `Order ${order._id.toString()} created for user ${customerId}`,
    );

    const customer = await this.userModel.findById(customerId);
    const token = await this.signOrderToken(order._id.toString(), customerId);

    await this.sendEmail({
      to: customer!.email,
      subject: 'Confirm your order',
      template: 'confirm-order',
      context: {
        order,
        name: customer!.fullName,
        shopName: process.env.SHOP_NAME,
        confirmLink: `${process.env.FRONTEND_URL}/orders/confirm?token=${token}`,
        cancelLink: `${process.env.FRONTEND_URL}/orders/cancel?token=${token}`,
        expiresIn: '2 days',
      },
    });

    return order.toJSON();
  }

  async confirmOrder(dto: ConfirmOrderTokenDto): Promise<Order> {
    const { orderId, userId } = await this.verifyOrderToken(dto.token);

    const order = await this.orderModel.findOneAndUpdate(
      { _id: orderId, userId, status: OrderStatus.PENDING },
      [
        {
          $set: {
            status: OrderStatus.CONFIRMED,
            paymentStatus: {
              $cond: [
                { $eq: ['$paymentMethod', PaymentMethod.BANKING] },
                PaymentStatus.PAID,
                '$paymentStatus',
              ],
            },
            orderStatusHistory: {
              $concatArrays: [
                '$orderStatusHistory',
                [
                  {
                    changedBy: new Types.ObjectId(userId),
                    status: OrderStatus.CONFIRMED,
                    changedAt: '$$NOW',
                  },
                ],
              ],
            },
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    );

    if (!order) {
      this.logger.warn(
        `Confirm failed: order ${orderId} not found or already processed`,
      );
      throw new NotFoundException('Order not found or already processed');
    }

    this.logger.log(`Order ${orderId} confirmed by user ${userId}`);

    const customer = await this.userModel.findById(userId);

    await this.sendEmail({
      to: customer!.email,
      subject: `Your order #${orderId.slice(-8).toUpperCase()} is confirmed`,
      template: 'order-confirmed',
      context: {
        order,
        name: customer?.fullName,
        shopName: process.env.SHOP_NAME,
      },
    });

    return order.toJSON();
  }

  async cancelOrder(dto: ConfirmOrderTokenDto): Promise<Order> {
    const { orderId, userId } = await this.verifyOrderToken(dto.token);
    const session = await this.orderModel.db.startSession();
    let order: OrderDocument | null = null;

    try {
      await session.withTransaction(async () => {
        const updated = await this.orderModel.findOneAndUpdate(
          {
            _id: orderId,
            userId,
            status: OrderStatus.PENDING,
            paymentStatus: { $ne: PaymentStatus.PAID },
          },
          {
            $set: { status: OrderStatus.CANCELLED },
            $push: {
              orderStatusHistory: {
                changedBy: userId,
                status: OrderStatus.CANCELLED,
                changedAt: new Date(),
              },
            },
          },
          { new: true, session },
        );

        if (!updated) {
          this.logger.warn(
            `Cancel failed: order ${orderId} not found or already processed`,
          );
          throw new NotFoundException('Order not found or already processed');
        }

        for (const item of updated.orderItems) {
          await this.productModel.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.quantity } },
            { session },
          );
        }

        order = updated;
      });
    } finally {
      await session.endSession();
    }

    this.logger.log(
      `Order ${orderId} cancelled by user ${userId}, stock restored`,
    );

    const customer = await this.userModel.findById(userId);

    await this.sendEmail({
      to: customer!.email,
      subject: `Your order #${orderId.slice(-8).toUpperCase()} is cancelled`,
      template: 'order-cancelled',
      context: {
        order,
        name: customer?.fullName,
        shopName: process.env.SHOP_NAME,
      },
    });

    return order!.toJSON();
  }

  async findAll(query: FilterOrderDto): Promise<any> {
    const page = Number(query.page) || 1;
    const itemsPerPage = Number(query.itemsPerPage) || 10;
    const skip = (page - 1) * itemsPerPage;

    const filter: Record<string, any> = {};

    const search = query.search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search) {
      filter.receiverName = { $regex: search, $options: 'i' };
    }

    if (query.userId) {
      filter.userId = query.userId;
    }

    const [items, total] = await Promise.all([
      this.orderModel.find(filter).skip(skip).limit(itemsPerPage),
      this.orderModel.countDocuments(filter),
    ]);

    const result = items.map((element) => element.toJSON());

    return {
      items: result,
      meta: {
        total,
        page,
        limit: itemsPerPage,
        totalPages: Math.ceil(total / itemsPerPage),
      },
    };
  }

  async findOne(
    id: string,
    requester: { userId: string; role: string },
  ): Promise<Order> {
    const order = await this.orderModel
      .findById(id)
      .populate('userId', 'name email')
      .populate('orderStatusHistory.changedBy', 'name role');

    if (!order) {
      this.logger.warn(`Order ${id} not found`);
      throw new NotFoundException('Order not found');
    }
    const isOwner = order.userId._id.toString() === requester.userId;
    const isAdminOrStaff = ['staff', 'admin'].includes(requester.role);

    if (!isOwner && !isAdminOrStaff) {
      this.logger.warn(`User ${requester.userId} denied access to order ${id}`);
      throw new ForbiddenException('You do not have access to this order');
    }

    return order.toJSON();
  }

  async findOrdersByCustomer(id: string): Promise<Order[]> {
    const orders = await this.orderModel.find({ userId: id });

    return orders.map((element) => element.toJSON());
  }

  async updatePaymentStatus(
    id: string,
    requester: { userId: string; role: string },
  ): Promise<Order> {
    if (!['staff', 'admin'].includes(requester.role)) {
      this.logger.warn(
        `User ${requester.userId} denied payment status update on order ${id}`,
      );
      throw new ForbiddenException('You do not have access to this order');
    }

    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: id,
        status: { $ne: OrderStatus.CANCELLED },
        paymentStatus: PaymentStatus.UNPAID,
      },
      { $set: { paymentStatus: PaymentStatus.PAID } },
      { returnDocument: 'after' },
    );

    if (!order) {
      const existing = await this.orderModel.findById(id);
      if (!existing) {
        this.logger.warn(`Payment update failed: order ${id} not found`);
        throw new NotFoundException('Order not found');
      }
      if (existing.status === OrderStatus.CANCELLED) {
        this.logger.warn(`Payment update failed: order ${id} is cancelled`);
        throw new BadRequestException(
          'Cannot update payment status for a cancelled order',
        );
      }
      this.logger.warn(`Payment update failed: order ${id} already paid`);
      throw new BadRequestException('Order is already marked as paid');
    }

    this.logger.log(`Order ${id} marked as paid by user ${requester.userId}`);

    const customer = await this.userModel
      .findById(order.userId)
      .select('email fullName');

    const orderCode = id.toString().slice(-8).toUpperCase();

    if (customer?.email) {
      await this.sendEmail({
        to: customer.email,
        subject: `Payment received for order #${orderCode}`,
        template: 'order-payment-confirmed',
        context: {
          order,
          name: customer.fullName,
          shopName: process.env.SHOP_NAME,
        },
      });
    }

    return order.toJSON();
  }

  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ): Promise<Order> {
    const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPING],
      [OrderStatus.SHIPPING]: [OrderStatus.COMPLETED],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      this.logger.warn(`Status update failed: order ${orderId} not found`);
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status;
    if (!allowedTransitions[currentStatus].includes(dto.newStatus)) {
      this.logger.warn(
        `Status update rejected for order ${orderId}: ${currentStatus} -> ${dto.newStatus} not allowed`,
      );
      throw new BadRequestException(
        `Cannot change order status from "${currentStatus}" to "${dto.newStatus}"`,
      );
    }

    const session = await this.orderModel.db.startSession();
    let updated!: OrderDocument;

    try {
      await session.withTransaction(async () => {
        if (
          currentStatus === OrderStatus.PENDING &&
          dto.newStatus === OrderStatus.CANCELLED
        ) {
          for (const item of order.orderItems) {
            await this.productModel.updateOne(
              { _id: item.productId },
              { $inc: { stock: item.quantity } },
              { session },
            );
          }
        }

        const set: Record<string, unknown> = { status: dto.newStatus };
        if (dto.newStatus === OrderStatus.COMPLETED) {
          set.paymentStatus = PaymentStatus.PAID;
        }

        const result = await this.orderModel.findOneAndUpdate(
          { _id: orderId, status: currentStatus },
          {
            $set: set,
            $push: {
              orderStatusHistory: {
                changedBy: adminId,
                status: dto.newStatus,
                changedAt: new Date(),
              },
            },
          },
          { new: true, session },
        );

        if (!result) {
          this.logger.warn(
            `Status update conflict on order ${orderId}: status changed concurrently`,
          );
          throw new ConflictException(
            'Order status was changed by someone else, please reload and try again',
          );
        }

        updated = result;
      });
    } finally {
      await session.endSession();
    }

    this.logger.log(
      `Order ${orderId} status changed ${currentStatus} -> ${dto.newStatus} by user ${adminId}`,
    );

    const customer = await this.userModel
      .findById(updated.userId)
      .select('email fullName');

    const orderCode = updated._id.toString().slice(-8).toUpperCase();

    if (customer?.email) {
      await this.sendEmail({
        to: customer.email,
        subject: `Your order #${orderCode} is ${dto.newStatus}`,
        template: `order-${dto.newStatus.toLowerCase()}`,
        context: {
          order: updated,
          name: customer.fullName,
          shopName: process.env.SHOP_NAME,
        },
      });
    }

    updated.$session(null);
    return updated.toJSON();
  }

  async updateShippingAddress(
    id: string,
    dto: ShippingAddressDto,
    userId: string,
  ) {
    const order = await this.orderModel.findOne({ _id: id, userId });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new ConflictException(
        'Order is being shipped, shipping address cannot be changed',
      );
    }

    const oldAddress = order.toJSON().shippingAddress;

    const updated = await this.orderModel.findOneAndUpdate(
      {
        _id: id,
        userId,
        status: { $in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
      },
      { shippingAddress: dto },
      { new: true },
    );

    if (!updated) {
      throw new ConflictException(
        'Order is being shipped, shipping address cannot be changed',
      );
    }

    const customer = await this.userModel
      .findById(updated.userId)
      .select('email fullName');

    const orderCode = id.toString().slice(-8).toUpperCase();

    if (customer?.email) {
      await this.sendEmail({
        to: customer.email,
        subject: `Shipping address updated for order #${orderCode}`,
        template: 'shipping-address-updated',
        context: {
          order: updated,
          oldAddress,
          newAddress: updated.toJSON().shippingAddress,
          name: customer.fullName,
          shopName: process.env.SHOP_NAME,
        },
      });
    }

    return updated.toJSON();
  }
}
