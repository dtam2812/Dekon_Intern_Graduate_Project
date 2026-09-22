import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Exclude } from 'class-transformer';
import { HydratedDocument } from 'mongoose';
import { AuthProvider } from 'src/enum/authProvider.enum';
import { toJSONTransform } from 'src/helpers/toJSON';

export type UserDocument = HydratedDocument<User>;

@Schema({
  toJSON: {
    ...toJSONTransform,
    transform: (doc: any, ret: any) => {
      toJSONTransform.transform(doc, ret);
      delete ret.password;
      return ret;
    },
  },
  timestamps: true,
})
export class User {
  @Prop({ required: true })
  fullName!: string;
  @Prop({ required: true, unique: true })
  email!: string;
  @Exclude()
  @Prop({ select: false })
  password?: string;
  @Prop({ required: true })
  role!: string;
  @Prop({ required: true, enum: AuthProvider })
  provider!: string;
  @Prop()
  providerId?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
