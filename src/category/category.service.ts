import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Logger } from 'nestjs-pino';
import { CreateCategoryDto } from 'src/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/dto/update-category.dto';
import { Category, CategoryDocument } from 'src/schemas/category.schema';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly logger: Logger,
  ) {}
  async create(dto: CreateCategoryDto): Promise<Category> {
    try {
      const category = await this.categoryModel.create({
        name: dto.name,
        slug: dto.slug,
      });
      this.logger.log(`Category ${category._id.toString()} created`);
      return category.toJSON();
    } catch (err) {
      if (err.code === 11000) {
        const field =
          Object.keys(err.keyPattern ?? err.keyValue ?? {})[0] ?? 'value';
        this.logger.warn(`Category creation conflict: duplicate ${field}`);
        throw new ConflictException(`This ${field} existed`);
      }
      throw err;
    }
  }

  async findAll(): Promise<Category[]> {
    const categories = await this.categoryModel.find();
    return categories.map((element) => element.toJSON());
  }

  async findOne(id: string): Promise<Category> {
    const cate = await this.categoryModel.findById(id);
    if (!cate) {
      this.logger.warn(`Category ${id} not found`);
      throw new NotFoundException('Category not found');
    }
    return cate.toJSON();
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    try {
      const cate = await this.categoryModel.findByIdAndUpdate(id, dto, {
        new: true,
        runValidators: true,
      });
      if (!cate) {
        this.logger.warn(`Update failed: category ${id} not found`);
        throw new NotFoundException('Category not found');
      }
      this.logger.log(`Category ${id} updated`);
      return cate.toJSON();
    } catch (err) {
      if (err.code === 11000) {
        const field =
          Object.keys(err.keyPattern ?? err.keyValue ?? {})[0] ?? 'value';
        this.logger.warn(
          `Category update conflict on ${id}: duplicate ${field}`,
        );
        throw new ConflictException(`This ${field} existed`);
      }
      throw err;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const cate = await this.categoryModel.findByIdAndDelete(id);
    if (!cate) {
      this.logger.warn(`Delete failed: category ${id} not found`);
      throw new NotFoundException('Category not found');
    }

    this.logger.log(`Category ${id} deleted`);

    return { message: 'Category deleted' };
  }
}
