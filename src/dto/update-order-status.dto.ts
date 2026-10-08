import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from 'src/enum/orderStatus.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    enumName: 'OrderStatus',
    description:
      'Order status, include pending, cancelled, confirmed, shipping, completed',
    example: 'pending',
  })
  @IsEnum(OrderStatus, {
    message: `Order status must be one of: ${Object.values(OrderStatus).join(', ')}`,
  })
  newStatus!: OrderStatus;
}
