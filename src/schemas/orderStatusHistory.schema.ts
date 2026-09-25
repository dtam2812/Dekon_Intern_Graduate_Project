import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderStatus } from 'src/enum/orderStatus.enum';
import { toJSONTransform } from 'src/helpers/toJSON';

export type OrderStatusHistoryDocument = HydratedDocument<OrderStatusHistory>;

@Schema({ toJSON: toJSONTransform })
export class OrderStatusHistory {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  changedBy!: Types.ObjectId;
  @Prop({
    required: true,
    enum: OrderStatus,
  })
  status!: string;
  @Prop({ required: true })
  changedAt!: Date;
}

export const OrderStatusHistorySchema =
  SchemaFactory.createForClass(OrderStatusHistory);
