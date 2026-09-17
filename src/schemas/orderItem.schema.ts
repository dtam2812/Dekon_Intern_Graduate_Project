import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OrderItemDocument = HydratedDocument<OrderItem>;

@Schema()
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId!: Types.ObjectId;
  @Prop({ required: true })
  productName!: string;
  @Prop({ required: true })
  orderedPrice!: number;
  @Prop({ required: true })
  quantity!: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);
