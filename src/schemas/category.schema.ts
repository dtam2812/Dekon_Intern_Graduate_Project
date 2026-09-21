import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({
  toJSON: {
    versionKey: false,
    transform: (doc, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  },
})
export class Category {
  @Prop({ required: true })
  name!: string;
  @Prop({ required: true })
  slug!: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
