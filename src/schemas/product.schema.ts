import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PriceHistory } from './priceHistory.schema';
import { toJSONTransform } from 'src/helpers/toJSON';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  toJSON: toJSONTransform,
  timestamps: true,
})
export class Product {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;
  @Prop({ required: true, unique: true })
  name!: string;
  @Prop({ required: true, unique: true })
  slug!: string;
  @Prop({ required: true })
  description!: string;
  @Prop({ required: true })
  price!: number;
  @Prop({ type: [PriceHistory] })
  priceHistory!: PriceHistory[];
  @Prop({ required: true })
  stock!: number;
  @Prop({ type: [String], required: true })
  images!: string[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
