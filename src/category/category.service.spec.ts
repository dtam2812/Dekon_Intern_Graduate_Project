import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { getModelToken } from '@nestjs/mongoose';
import { CategoryService } from './category.service';
import { Category } from 'src/schemas/category.schema';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('CategoryService', () => {
  let service: CategoryService;

  const mockCategoryModel = {
    create: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findById: jest.fn(),
  };

  const mockLogger = { warn: jest.fn(), log: jest.fn() };

  const categoryId = '507f1f77bcf86cd799439011';

  let categoryResponse: {
    id: string;
    name: string;
    slug: string;
  };

  let mockCategory: {
    _id: Types.ObjectId;
    id: string;
    name: string;
    slug: string;
    toJSON: () => typeof categoryResponse;
  };

  beforeEach(async () => {
    categoryResponse = {
      id: categoryId,
      name: 'bootcut jeans',
      slug: 'bootcut-jeans',
    };

    mockCategory = {
      _id: new Types.ObjectId(categoryId),
      id: categoryId,
      name: 'bootcut jeans',
      slug: 'bootcut-jeans',
      toJSON: () => categoryResponse,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: getModelToken(Category.name), useValue: mockCategoryModel },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Create category', () => {
    const dto = {
      name: 'bootcut jeans',
      slug: 'bootcut-jeans',
    };
    it('should create new category', async () => {
      mockCategoryModel.create.mockResolvedValue(mockCategory);

      const result = await service.create(dto);

      expect(mockCategoryModel.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(categoryResponse);
    });

    it('should return ConflictException if category already existed', async () => {
      mockCategoryModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockCategoryModel.create).toHaveBeenCalledWith(dto);
    });

    it('should rethrow unexpected create errors', async () => {
      mockCategoryModel.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create(dto)).rejects.toThrow('DB down');
    });
  });

  describe('find all', () => {
    it('should return list of categories', async () => {
      mockCategoryModel.find.mockResolvedValue([mockCategory, mockCategory]);

      const result = await service.findAll();
      expect(mockCategoryModel.find).toHaveBeenCalled();
      expect(result).toEqual([categoryResponse, categoryResponse]);
    });

    it('should return an empty array if there is no category', async () => {
      mockCategoryModel.find.mockResolvedValue([]);

      const result = await service.findAll();
      expect(mockCategoryModel.find).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('find a category', () => {
    it('should return a category', async () => {
      mockCategoryModel.findById.mockResolvedValue(mockCategory);

      const result = await service.findOne(categoryId);
      expect(mockCategoryModel.findById).toHaveBeenCalled();
      expect(result).toEqual(categoryResponse);
    });

    it('should return NotFoundException if category not found', async () => {
      mockCategoryModel.findById.mockResolvedValue(null);

      await expect(service.findOne(categoryId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Update a category', () => {
    const dto = {
      name: 'flare jeans',
    };
    it("should update a category's information", async () => {
      mockCategoryModel.findByIdAndUpdate.mockResolvedValue(mockCategory);

      const result = await service.update(categoryId, dto);

      expect(mockCategoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
        categoryId,
        dto,
        { new: true, runValidators: true },
      );
      expect(result).toEqual(categoryResponse);
    });

    it('should return NotFoundException if category not found', async () => {
      mockCategoryModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(service.update(categoryId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should rethrow unexpected update errors', async () => {
      mockCategoryModel.findByIdAndUpdate.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(service.update(categoryId, dto)).rejects.toThrow('DB down');
    });
  });

  describe('Delete category', () => {
    it('should delete a category', async () => {
      mockCategoryModel.findByIdAndDelete.mockResolvedValue(mockCategory);

      const result = await service.remove(categoryId);

      expect(mockCategoryModel.findByIdAndDelete).toHaveBeenCalledWith(
        categoryId,
      );
      expect(result).toEqual({ message: 'Category deleted' });
    });

    it('should return NotFoundException if category not found', async () => {
      mockCategoryModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.remove(categoryId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
