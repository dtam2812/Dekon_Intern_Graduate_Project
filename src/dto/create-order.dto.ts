import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from 'src/enum/paymentMethod.enum';

export class OrderItemDto {
  @IsMongoId({ message: 'productId must be a valid id' })
  productId!: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;
}

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty({ message: 'houseNumber must be filled' })
  houseNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'street must be filled' })
  street!: string;

  @IsString()
  @IsNotEmpty({ message: 'ward must be filled' })
  ward!: string;

  @IsString()
  @IsNotEmpty({ message: 'district must be filled' })
  district!: string;

  @IsString()
  @IsNotEmpty({ message: 'city must be filled' })
  city!: string;

  @IsString()
  @IsNotEmpty({ message: 'country must be filled' })
  country!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must have at least 1 item' })
  @ArrayMaxSize(50, { message: 'Order can have at most 50 items' })
  @ArrayUnique((item: OrderItemDto) => item.productId, {
    message: 'items must not contain duplicate productId',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsDefined({ message: 'shippingAddress must be provided' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @IsEnum(PaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod!: PaymentMethod;

  @IsString()
  @IsNotEmpty({ message: 'receiverName must be filled' })
  receiverName!: string;

  @IsPhoneNumber('VN', {
    message: 'receiverPhone must be a valid VN phone number',
  })
  receiverPhone!: string;
}
