import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { toJSONTransform } from 'src/helpers/toJSON';

export type PriceHistoryDocument = HydratedDocument<PriceHistory>;

@Schema({
  toJSON: toJSONTransform,
  _id: false,
})
export class PriceHistory {
  @Prop({ type: Number, required: true })
  updatedPrice!: number;

  @Prop({ type: Date, required: true, default: () => new Date() })
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  updatedBy!: Types.ObjectId;
}

export const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);
