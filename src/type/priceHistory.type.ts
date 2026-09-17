import { User } from 'src/schemas/user.schema';

export type priceHistory = {
  updatedPrice: number;
  updatedAt: Date;
  updatedBy: User;
};
