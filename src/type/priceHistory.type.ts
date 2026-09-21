import { Types } from 'mongoose';

export type priceHistory = {
  updatedPrice: number;
  updatedAt: Date;
  updatedBy: Types.ObjectId;
};
