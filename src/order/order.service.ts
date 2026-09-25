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
import { CreateOrderDto } from 'src/dto/create-order.dto';
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
      throw new NotFoundException('Product not found');
    }

    if (product.stock < quantity) {
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
      throw new BadRequestException('Invalid or expired token');
    }
  }

  async create(customerId: string, dto: CreateOrderDto): Promise<Order> {
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

  async confirmOrder(token: string): Promise<Order> {
    const { orderId, userId } = await this.verifyOrderToken(token);

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
      throw new NotFoundException('Order not found or already processed');
    }

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

  async cancelOrder(token: string): Promise<Order> {
    const { orderId, userId } = await this.verifyOrderToken(token);
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

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).skip(skip).limit(itemsPerPage),
      this.orderModel.countDocuments(filter),
    ]);

    const result = data.map((element) => element.toJSON());

    return {
      data: result,
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
      throw new NotFoundException('Order not found');
    }
    const isOwner = order.userId._id.toString() === requester.userId;
    const isAdminOrStaff = ['staff', 'admin'].includes(requester.role);

    if (!isOwner && !isAdminOrStaff) {
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
        throw new NotFoundException('Order not found');
      }
      if (existing.status === OrderStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot update payment status for a cancelled order',
        );
      }
      throw new BadRequestException('Order is already marked as paid');
    }
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
      throw new NotFoundException('Order not found');
    }

    const currentStatus = order.status;
    if (!allowedTransitions[currentStatus].includes(dto.newStatus)) {
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
          throw new ConflictException(
            'Order status was changed by someone else, please reload and try again',
          );
        }

        updated = result;
      });
    } finally {
      await session.endSession();
    }

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
}
