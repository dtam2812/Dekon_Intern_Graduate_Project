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
import { CreateOrderDto, ShippingAddressDto } from 'src/dto/create-order.dto';
import { FilterOrderDto } from 'src/dto/filter-order.dto';
import { Roles } from 'src/decorator/role.decorator';
import { UserRole } from 'src/enum/userRole.enum';
import { UpdateOrderStatusDto } from 'src/dto/update-order-status.dto';
import { Order } from 'src/schemas/order.schema';
import { ValidateObjectIdPipe } from 'src/pipe/validate-object-id.pipe';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { PaginatedResponseDto } from 'src/dto/paginated-response.dto';
import { ConfirmOrderTokenDto } from 'src/dto/confirm-order-token.dto';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new order',
    description:
      'Creates a new order for the current user. Validates product stock and deducts stock upon creation. Sends a confirmation email.',
  })
  @ApiCreatedResponse({
    type: Order,
    description: 'Order successfully created',
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed / Insufficient stock for product / This product is out of stock',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  create(@Req() req, @Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(req.user.sub, createOrderDto);
  }

  @Post('confirm')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Customers confirm their orders, get token on the browser's searching bar",
    description: 'Confirms an order using a verification token sent via email.',
  })
  @ApiCreatedResponse({
    type: Order,
    description: 'Order successfully confirmed',
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token / Validation failed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({
    description: 'Order not found or already processed',
  })
  confirmOrder(@Body() dto: ConfirmOrderTokenDto): Promise<Order> {
    return this.orderService.confirmOrder(dto);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Customers cancel their orders, get token on the browser's searching bar",
    description:
      'Cancels an order using a verification token sent via email. Restores product stock.',
  })
  @ApiCreatedResponse({
    type: Order,
    description: 'Order successfully cancelled',
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired token / Validation failed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({
    description: 'Order not found or already processed',
  })
  cancelOrder(@Body() dto: ConfirmOrderTokenDto): Promise<Order> {
    return this.orderService.cancelOrder(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiExtraModels(PaginatedResponseDto)
  @ApiOperation({
    summary: 'Get all orders, admin and staff only',
    description:
      'Retrieves a paginated list of all orders with optional filters. Only accessible by administrators and staff.',
  })
  @ApiOkResponse({
    description: 'Successfully retrieved list of orders',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(Order) },
            },
          },
        },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  findAll(@Query() query: FilterOrderDto): Promise<Order[]> {
    return this.orderService.findAll(query);
  }

  @Get('byCustomer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current user's orders",
    description:
      'Retrieves all orders placed by the currently authenticated user.',
  })
  @ApiOkResponse({
    type: Order,
    isArray: true,
    description: 'Successfully retrieved user orders',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findOrdersByCustomer(@Req() req: any): Promise<Order[]> {
    return this.orderService.findOrdersByCustomer(req.user.sub);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Find current user's order by id",
    description:
      'Finds a specific order by its ID. Users can only access their own orders, while administrators and staff can access any order.',
  })
  @ApiOkResponse({
    type: Order,
    description: 'Successfully retrieved order details',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'You do not have access to this order',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  findOne(
    @Param('id', ValidateObjectIdPipe) id: string,
    @Req() req: any,
  ): Promise<Order> {
    return this.orderService.findOne(id, {
      userId: req.user.sub,
      role: req.user.role,
    });
  }

  @Patch('updatePaymentStatus/:id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update order's payment status, admin and staff only",
    description:
      'Updates the payment status of an order to PAID. Only accessible by administrators and staff.',
  })
  @ApiOkResponse({
    type: Order,
    description: 'Successfully updated payment status',
  })
  @ApiBadRequestResponse({
    description:
      'Cannot update payment status for a cancelled order / Order is already marked as paid / Validation failed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Forbidden resource / You do not have access to this order',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  updatePaymentStatus(
    @Param('id', ValidateObjectIdPipe) id: string,
    @Req() req: any,
  ): Promise<Order> {
    return this.orderService.updatePaymentStatus(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update order's status, admin and staff only",
    description:
      'Updates the status of an order (e.g., PENDING -> CONFIRMED). Validates status transitions. Only accessible by administrators and staff.',
  })
  @ApiOkResponse({
    type: Order,
    description: 'Successfully updated order status',
  })
  @ApiBadRequestResponse({
    description:
      'Cannot change order status from current to new status / Validation failed',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({
    description:
      'Order status was changed by someone else, please reload and try again',
  })
  updateOrderStatus(
    @Param('id', ValidateObjectIdPipe) orderId: string,
    @Body() updateOrderStatus: UpdateOrderStatusDto,
    @Req() req: any,
  ): Promise<Order> {
    return this.orderService.updateOrderStatus(
      orderId,
      updateOrderStatus,
      req.user.sub,
    );
  }

  @Patch('/shippingAddress/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update shipping address',
    description:
      'Updates the shipping address of an order. Only allowed if the order is PENDING or CONFIRMED.',
  })
  @ApiOkResponse({
    type: Order,
    description: 'Successfully updated shipping address',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({
    description: 'Order is being shipped, shipping address cannot be changed',
  })
  updateShippingAddress(
    @Param('id', ValidateObjectIdPipe) orderId: string,
    @Body() shippingAddressDto: ShippingAddressDto,
    @Req() req: any,
  ): Promise<Order> {
    return this.orderService.updateShippingAddress(
      orderId,
      shippingAddressDto,
      req.user.sub,
    );
  }
}
