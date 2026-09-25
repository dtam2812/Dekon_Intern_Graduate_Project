import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from 'src/dto/create-order.dto';
import { FilterOrderDto } from 'src/dto/filter-order.dto';
import { Roles } from 'src/decorator/role.decorator';
import { UserRole } from 'src/enum/userRole.enum';
import { UpdateOrderStatusDto } from 'src/dto/update-order-status.dto';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Order } from 'src/schemas/order.schema';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Req() req, @Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(req.user.sub, createOrderDto);
  }

  @Post('confirm')
  confirmOrder(@Body('token') token: string): Promise<Order> {
    return this.orderService.confirmOrder(token);
  }

  @Post('cancel')
  cancelOrder(@Body('token') token: string): Promise<Order> {
    return this.orderService.cancelOrder(token);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  findAll(@Query() query: FilterOrderDto): Promise<Order[]> {
    return this.orderService.findAll(query);
  }

  @Get('byCustomer')
  findOrdersByCustomer(@Req() req: any): Promise<Order[]> {
    return this.orderService.findOrdersByCustomer(req.user.sub);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @Req() req: any,
  ): Promise<Order> {
    return this.orderService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  updateOrderStatus(
    @Param('id', ParseObjectIdPipe) orderId: string,
    @Body() updateOrderStatus: UpdateOrderStatusDto,
    @Req() req: any,
  ): Promise<Order> {
    return this.orderService.updateOrderStatus(
      orderId,
      updateOrderStatus,
      req.user.sub,
    );
  }
}
