import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { priceHistory } from 'src/type/priceHistory.type';

export type ProductDocument = HydratedDocument<Product>;

@Schema()
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;
  @Prop({ required: true })
  name!: string;
  @Prop({ required: true })
  slug!: string;
  @Prop({ required: true })
  description!: string;
  @Prop({ required: true })
  price!: number;
  @Prop({ required: true })
  priceHistory!: priceHistory[];
  @Prop({ required: true })
  stock!: number;
  @Prop({ type: [String], required: true })
  images!: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
