import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateCategoryDto } from 'src/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/dto/update-category.dto';
import { Category, CategoryDocument } from 'src/schemas/category.schema';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}
  async create(dto: CreateCategoryDto): Promise<Category> {
    try {
      return await this.categoryModel.create({
        name: dto.name,
        slug: dto.slug,
      });
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
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
      if (!cate) throw new NotFoundException('Category not found');
      return cate.toJSON();
    } catch (err) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        throw new ConflictException(`This ${field} existed`);
      }
      throw err;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    const cate = await this.categoryModel.findByIdAndDelete(id);
    if (!cate) {
      throw new NotFoundException('Category not found');
    }

    return { message: 'Category deleted' };
  }
}
