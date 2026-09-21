import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { unlink } from 'fs/promises';
import { Model, UpdateQuery } from 'mongoose';
import { join } from 'path';
import { CreateProductDto } from 'src/dto/create-product.dto';
import { UpdateProductDto } from 'src/dto/update-product.dto';
import { Product, ProductDocument } from 'src/schemas/product.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  private async removeFiles(urls: string[]): Promise<void> {
    await Promise.all(
      urls.map((element) =>
        unlink(join(process.cwd(), element)).catch(() => undefined),
      ),
    );
  }

  async create(
    dto: CreateProductDto,
    files: Express.Multer.File[],
    id: string,
  ): Promise<Product> {
    const fileUrls = files.map(
      (element) => `uploads/images/${element.filename}`,
    );

    try {
      const product = await this.productModel.create({
        ...dto,
        images: fileUrls,
        priceHistory: [
          { updatedPrice: dto.price, updatedAt: new Date(), updatedBy: id },
        ],
      });
      return product.toJSON();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`This ${field} existed`);
      }
      throw error;
    }
  }

  async findAll(): Promise<Product[]> {
    const products = await this.productModel.find();
    return products.map((element) => element.toJSON());
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product.toJSON();
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    files: Express.Multer.File[],
    adminId: string,
  ): Promise<Product> {
    const set: Record<string, any> = { ...dto };

    if (files?.length) {
      set.images = files.map((f) => `uploads/images/${f.filename}`);
    }

    const update: UpdateQuery<ProductDocument> = { $set: set };

    if (dto.price !== undefined) {
      update.$push = {
        priceHistory: {
          updatedPrice: dto.price,
          updatedAt: new Date(),
          updatedBy: adminId,
        },
      };
    }

    try {
      const product = await this.productModel.findByIdAndUpdate(id, update, {
        new: true,
      });
      if (!product) throw new NotFoundException('Product not found');
      return product.toJSON();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`This ${field} existed`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return { message: 'Product deleted' };
  }
}
