import { IsEnum } from 'class-validator';
import { OrderStatus } from 'src/enum/orderStatus.enum';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  newStatus!: OrderStatus;
}
