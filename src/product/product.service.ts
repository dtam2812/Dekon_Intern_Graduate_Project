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
import { FilterProductDto } from 'src/dto/filter-product.dto';
import { UpdateProductDto } from 'src/dto/update-product.dto';
import { Category, CategoryDocument } from 'src/schemas/category.schema';
import { Product, ProductDocument } from 'src/schemas/product.schema';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  private async removeFiles(urls: string[]): Promise<void> {
    await Promise.all(
      urls.map((element) =>
        unlink(join(process.cwd(), element)).catch(() => undefined),
      ),
    );
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await this.categoryModel.exists({ _id: categoryId });
    if (!exists) {
      throw new NotFoundException('Category not found');
    }
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
      await this.assertCategoryExists(dto.categoryId);
      const product = await this.productModel.create({
        ...dto,
        images: fileUrls,
        priceHistory: [
          { updatedPrice: dto.price, updatedAt: new Date(), updatedBy: id },
        ],
      });
      return product.toJSON();
    } catch (error) {
      await this.removeFiles(fileUrls);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new ConflictException(`This ${field} existed`);
      }
      throw error;
    }
  }

  async findAll(query: FilterProductDto): Promise<any> {
    const { page = 1, itemsPerPage = 10 } = query;
    const skip = (page - 1) * itemsPerPage;

    const filter: Record<string, any> = {};

    const search = query.search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (query.categoryId) {
      filter.categoryId = query.categoryId;
    }

    const [data, total] = await Promise.all([
      this.productModel.find(filter).skip(skip).limit(itemsPerPage),
      this.productModel.countDocuments(filter),
    ]);
    const result = data.map((element) => element.toJSON());

    return {
      data: result,
      meta: {
        total,
        page,
        limit: itemsPerPage,
        totalPages: Math.ceil(total / itemsPerPage),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productModel
      .findById(id)
      .populate('categoryId')
      .populate('priceHistory.updatedBy', 'name email');
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
    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const existing = files?.length
      ? await this.productModel.findById(id).select('images').lean()
      : null;

    if (files?.length && !existing) {
      await this.removeFiles(files.map((f) => `uploads/images/${f.filename}`));
      throw new NotFoundException('Product not found');
    }
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
      if (!product) {
        if (files?.length) {
          await this.removeFiles(set.images);
        }
        throw new NotFoundException('Product not found');
      }

      if (files?.length && existing?.images?.length) {
        await this.removeFiles(existing.images);
      }
      return product.toJSON();
    } catch (error) {
      if (files?.length && !(error instanceof NotFoundException)) {
        await this.removeFiles(set.images);
      }
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

    if (product.images?.length) {
      await this.removeFiles(product.images);
    }

    return { message: 'Product deleted' };
  }
}
