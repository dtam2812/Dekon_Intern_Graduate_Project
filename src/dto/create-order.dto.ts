import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    type: String,
    description: 'Id of buying product',
    example: '6ab162d4ac4294c9b94dfdea',
  })
  @IsMongoId({ message: 'productId must be a valid id' })
  productId!: string;

  @ApiProperty({
    type: Number,
    description: 'Quantity of buying product',
    example: 2,
  })
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity!: number;
}

export class ShippingAddressDto {
  @ApiProperty({
    type: String,
    description: "Shipping address's house number",
    example: '12a',
  })
  @IsString()
  @IsNotEmpty({ message: 'houseNumber must be filled' })
  houseNumber!: string;

  @ApiProperty({
    type: String,
    description: "Shipping address's street",
    example: 'Nguyen Xi',
  })
  @IsString()
  @IsNotEmpty({ message: 'street must be filled' })
  street!: string;

  @ApiProperty({
    type: String,
    description: "Shipping address's ward",
    example: 'Binh Loi Trung',
  })
  @IsString()
  @IsNotEmpty({ message: 'ward must be filled' })
  ward!: string;

  @ApiProperty({
    type: String,
    description: "Shipping address's district",
    example: 'Binh Thanh',
  })
  @IsString()
  @IsNotEmpty({ message: 'district must be filled' })
  district!: string;

  @ApiProperty({
    type: String,
    description: "Shipping address's city",
    example: 'HCM',
  })
  @IsString()
  @IsNotEmpty({ message: 'city must be filled' })
  city!: string;

  @ApiProperty({
    type: String,
    description: "Shipping address's country",
    example: 'Viet Nam',
  })
  @IsString()
  @IsNotEmpty({ message: 'country must be filled' })
  country!: string;

  @ApiProperty({
    type: String,
    description: "Shipping address's note",
    example: 'Giao bao ve neu khong goi duoc',
    required: false,
  })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    type: [OrderItemDto],
    description: 'Order item list',
    example: [
      {
        productId: '6ab237a0317f8123b6bad711',
        quantity: 2,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Order must have at least 1 item' })
  @ArrayMaxSize(50, { message: 'Order can have at most 50 items' })
  @ArrayUnique((item: OrderItemDto) => item.productId, {
    message: 'items must not contain duplicate productId',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiProperty({
    type: ShippingAddressDto,
    description: "Order's shipping address",
    example: {
      houseNumber: '219',
      street: 'Nguyen Xi',
      ward: 'Binh Loi Trung',
      district: 'Binh Thanh',
      city: 'HCM',
      country: 'Viet Nam',
    },
  })
  @IsDefined({ message: 'shippingAddress must be provided' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @ApiProperty({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    description: 'Payment method, include Banking, COD',
    example: 'COD',
  })
  @IsEnum(PaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  paymentMethod!: PaymentMethod;

  @ApiProperty({
    type: String,
    description: 'Receiver name',
    example: 'Dinh Nguyen Duc Tam',
  })
  @IsString()
  @IsNotEmpty({ message: 'receiverName must be filled' })
  receiverName!: string;

  @ApiProperty({
    type: String,
    description: 'Receiver phone number',
    example: '0396528253',
  })
  @IsPhoneNumber('VN', {
    message: 'receiverPhone must be a valid VN phone number',
  })
  receiverPhone!: string;
}
