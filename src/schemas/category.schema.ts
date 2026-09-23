import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { toJSONTransform } from 'src/helpers/toJSON';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({
  toJSON: toJSONTransform,
})
export class Category {
  @Prop({ required: true, unique: true })
  name!: string;
  @Prop({ required: true, unique: true })
  slug!: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
