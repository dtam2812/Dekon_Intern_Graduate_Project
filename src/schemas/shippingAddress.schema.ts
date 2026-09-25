import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ShippingAddress {
  @Prop() houseNumber!: string;
  @Prop() street!: string;
  @Prop() ward!: string;
  @Prop() district!: string;
  @Prop() city!: string;
  @Prop() country!: string;
  @Prop() note?: string;
}

export const ShippingAddressSchema =
  SchemaFactory.createForClass(ShippingAddress);
