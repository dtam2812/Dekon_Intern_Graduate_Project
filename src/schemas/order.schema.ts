import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { OrderItem } from './orderItem.schema';
import { PaymentMethod } from 'src/enum/paymentMethod.enum';
import { PaymentStatus } from 'src/enum/paymentStatus.enum';
import { OrderStatusHistory } from './orderStatusHistory.schema';
import { OrderStatus } from 'src/enum/orderStatus.enum';
import { toJSONTransform } from 'src/helpers/toJSON';
import { ShippingAddress } from './shippingAddress.schema';

export type OrderDocument = HydratedDocument<Order>;

@Schema({
  toJSON: toJSONTransform,
  timestamps: true,
})
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;
  @Prop({ required: true })
  total!: number;
  @Prop({
    type: String,
    required: true,
    enum: OrderStatus,
  })
  status!: OrderStatus;
  @Prop({ required: true })
  shippingAddress!: ShippingAddress;
  @Prop({ type: String, required: true, enum: PaymentMethod })
  paymentMethod!: PaymentMethod;
  @Prop({ required: true })
  receiverName!: string;
  @Prop({ required: true })
  receiverPhone!: string;
  @Prop({ type: String, required: true, enum: PaymentStatus })
  paymentStatus!: PaymentStatus;
  @Prop({ type: [OrderItem], required: true })
  orderItems!: OrderItem[];
  @Prop({ type: [OrderStatusHistory], required: true })
  orderStatusHistory!: OrderStatusHistory[];
}

export const OrderSchema = SchemaFactory.createForClass(Order);
