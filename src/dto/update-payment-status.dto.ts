import { IsEnum } from 'class-validator';
import { PaymentStatus } from 'src/enum/paymentStatus.enum';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  newStatus!: PaymentStatus;
}
