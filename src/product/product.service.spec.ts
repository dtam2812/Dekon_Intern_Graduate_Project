import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ProductService } from './product.service';
import { PriceHistory } from 'src/schemas/priceHistory.schema';
import { Product } from 'src/schemas/product.schema';
import { Category } from 'src/schemas/category.schema';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';

jest.mock('fs/promises', () => ({ unlink: jest.fn() }));

describe('ProductService', () => {
  let service: ProductService;

  const mockUnlink = unlink as jest.Mock;

  const mockProductModel = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const mockCategoryModel = {
    exists: jest.fn(),
  };

  const mockLogger = { warn: jest.fn(), log: jest.fn() };

  // find(filter).skip(n).limit(n)
  const mockFindChain = (value) => {
    const limit = jest.fn().mockResolvedValue(value);
    const skip = jest.fn().mockReturnValue({ limit });
    mockProductModel.find.mockReturnValue({ skip });
    return { skip, limit };
  };

  // findById(id).populate(...).populate(...)
  const mockFindByIdPopulateChain = (value) => {
    const secondPopulate = jest.fn().mockResolvedValue(value);
    const firstPopulate = jest
      .fn()
      .mockReturnValue({ populate: secondPopulate });
    mockProductModel.findById.mockReturnValue({ populate: firstPopulate });
    return { firstPopulate, secondPopulate };
  };

  // findById(id).select('images').lean()
  const mockFindExisting = (value) => {
    const lean = jest.fn().mockResolvedValue(value);
    const select = jest.fn().mockReturnValue({ lean });
    mockProductModel.findById.mockReturnValue({ select });
    return { select, lean };
  };

  const productId = '507f1f77bcf86cd799439011';
  const categoryId = '507f1f77bcf86cd799439012';
  const adminId = '507f1f77bcf86cd799439033';

  const newFiles = [{ filename: 'new.png' }] as Express.Multer.File[];
  const newImageUrls = ['uploads/images/new.png'];
  const oldImageUrls = ['uploads/images/old.png'];

  const filePath = (url: string) =>
    join(process.cwd(), 'uploads/images', basename(url));

  let productResponse: {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    priceHistory: PriceHistory[];
    stock: number;
    images: string[];
  };

  let mockProduct: {
    _id: Types.ObjectId;
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    priceHistory: PriceHistory[];
    stock: number;
    images: string[];
    toJSON: () => typeof productResponse;
  };

  beforeEach(async () => {
    productResponse = {
      id: productId,
      categoryId: categoryId,
      name: 'jeans bootcut whenever',
      slug: 'jeans-bootcut-whenever',
      description: 'quan dep gia tot',
      price: 1000000,
      priceHistory: [],
      stock: 28,
      images: ['uploads/images/new.png'],
    };

    mockProduct = {
      _id: new Types.ObjectId(productId),
      id: productId,
      categoryId: categoryId,
      name: 'jeans bootcut whenever',
      slug: 'jeans-bootcut-whenever',
      description: 'quan dep gia tot',
      price: 1000000,
      priceHistory: [],
      stock: 28,
      images: ['uploads/images/new.png'],
      toJSON: () => productResponse,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: getModelToken(Category.name), useValue: mockCategoryModel },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    mockUnlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Create product', () => {
    const dto = {
      categoryId: categoryId,
      name: 'jeans bootcut whenever',
      slug: 'jeans-bootcut-whenever',
      description: 'quan dep gia tot',
      price: 1000000,
      priceHistory: [],
      stock: 28,
      images: ['uploads/url'],
    };
    it('should create new product', async () => {
      mockCategoryModel.exists.mockResolvedValue({ _id: categoryId });
      mockProductModel.create.mockResolvedValue(mockProduct);

      const result = await service.create(dto, newFiles, adminId);

      expect(mockCategoryModel.exists).toHaveBeenCalledWith({
        _id: categoryId,
      });
      expect(mockProductModel.create).toHaveBeenCalledWith({
        ...dto,
        images: newImageUrls,
        priceHistory: [
          {
            updatedPrice: dto.price,
            updatedAt: expect.any(Date),
            updatedBy: adminId,
          },
        ],
      });
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(result).toEqual(productResponse);
    });

    it('should throw NotFoundException if category not found and remove uploaded files', async () => {
      mockCategoryModel.exists.mockResolvedValue(null);

      await expect(service.create(dto, newFiles, adminId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockProductModel.create).not.toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
    });

    it('should throw ConflicException on duplicate key error and remvove uploaded files', async () => {
      mockCategoryModel.exists.mockResolvedValue({ _id: categoryId });
      mockProductModel.create.mockRejectedValue({ code: 11000 });

      await expect(service.create(dto, newFiles, adminId)).rejects.toThrow(
        ConflictException,
      );
      expect(mockProductModel.create).toHaveBeenCalledWith({
        ...dto,
        images: newImageUrls,
        priceHistory: [
          {
            updatedPrice: dto.price,
            updatedAt: expect.any(Date),
            updatedBy: adminId,
          },
        ],
      });
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
    });

    it('should rethrow unexpected create errors', async () => {
      mockCategoryModel.exists.mockResolvedValue({ _id: categoryId });
      mockProductModel.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create(dto, newFiles, adminId)).rejects.toThrow(
        'DB down',
      );
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
    });

    it('should not call unlink if there are no uploaded files', async () => {
      mockCategoryModel.exists.mockResolvedValue({ _id: categoryId });
      mockProductModel.create.mockRejectedValue(new Error('DB down'));

      await expect(service.create(dto, [], adminId)).rejects.toThrow('DB down');
      expect(mockUnlink).not.toHaveBeenCalled();
    });
  });

  describe('Find all', () => {
    it('should return list of products with default pagination', async () => {
      const { skip, limit } = mockFindChain([mockProduct, mockProduct]);
      mockProductModel.countDocuments.mockResolvedValue(2);

      const result = await service.findAll({});

      expect(mockProductModel.find).toHaveBeenCalledWith({});
      expect(skip).toHaveBeenCalledWith(0);
      expect(limit).toHaveBeenCalledWith(10);
      expect(mockProductModel.countDocuments).toHaveBeenCalled();
      expect(result).toEqual({
        items: [productResponse, productResponse],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      });
    });

    it('should apply search, category filter and pagination', async () => {
      const { skip, limit } = mockFindChain([mockProduct, mockProduct]);
      mockProductModel.countDocuments.mockResolvedValue(10);
      const filter = {
        name: { $regex: 'jeans', $options: 'i' },
        categoryId: categoryId,
      };

      const result = await service.findAll({
        search: 'jeans',
        categoryId,
        page: 3,
        itemsPerPage: 3,
      });

      expect(mockProductModel.find).toHaveBeenCalledWith(filter);
      expect(skip).toHaveBeenCalledWith(6);
      expect(limit).toHaveBeenCalledWith(3);
      expect(mockProductModel.countDocuments).toHaveBeenCalledWith(filter);
      expect(result).toEqual({
        items: [productResponse, productResponse],
        meta: { total: 10, page: 3, limit: 3, totalPages: 4 },
      });
    });

    it('should escape regex special characters in search', async () => {
      mockFindChain([]);
      mockProductModel.countDocuments.mockResolvedValue(0);

      await service.findAll({ search: 'a.b*' });

      expect(mockProductModel.find).toHaveBeenCalledWith({
        name: { $regex: 'a\\.b\\*', $options: 'i' },
      });
    });

    it('should return empty data if there is no product', async () => {
      mockFindChain([]);
      mockProductModel.countDocuments.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result).toEqual({
        items: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
    });
  });

  describe('Find a product', () => {
    it('should return a product with populated fields', async () => {
      const { firstPopulate, secondPopulate } =
        mockFindByIdPopulateChain(mockProduct);

      const result = await service.findOne(productId);

      expect(mockProductModel.findById).toHaveBeenCalledWith(productId);
      expect(firstPopulate).toHaveBeenCalledWith('categoryId');
      expect(secondPopulate).toHaveBeenCalledWith(
        'priceHistory.updatedBy',
        'fullName',
      );
      expect(result).toEqual(productResponse);
    });

    it('should return NotFoundException if product not found', async () => {
      mockFindByIdPopulateChain(null);

      await expect(service.findOne(productId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Update product', () => {
    const dto = { name: 'flare jeans' };
    it("should update a product's information, without files and price changing", async () => {
      mockProductModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

      const result = await service.update(productId, dto, [], adminId);

      expect(mockProductModel.findById).not.toHaveBeenCalled();
      expect(mockCategoryModel.exists).not.toHaveBeenCalled();
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        { $set: dto },
        { new: true },
      );
      expect(unlink).not.toHaveBeenCalled();
      expect(result).toEqual(productResponse);
    });

    it("should update a product's information, with price changing", async () => {
      const priceDto = { price: 1200000 };
      mockProductModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

      const result = await service.update(productId, priceDto, [], adminId);

      expect(mockProductModel.findById).not.toHaveBeenCalled();
      expect(mockCategoryModel.exists).not.toHaveBeenCalled();
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        {
          $set: priceDto,
          $push: {
            priceHistory: {
              updatedPrice: 1200000,
              updatedAt: expect.any(Date),
              updatedBy: adminId,
            },
          },
        },
        { new: true },
      );
      expect(result).toEqual(productResponse);
    });

    it("should update a product's information, with files changing", async () => {
      const { select } = mockFindExisting({ images: oldImageUrls });
      mockProductModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

      const result = await service.update(productId, dto, newFiles, adminId);

      expect(select).toHaveBeenCalledWith('images');
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        { $set: { ...dto, images: newImageUrls } },
        { new: true },
      );
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(oldImageUrls[0]));
      expect(result).toEqual(productResponse);
    });

    it('should throw NotFoundException and remove new files if categoryId not exists', async () => {
      mockCategoryModel.exists.mockResolvedValue(null);

      await expect(
        service.update(productId, { categoryId }, newFiles, adminId),
      ).rejects.toThrow(NotFoundException);
      expect(mockCategoryModel.exists).toHaveBeenCalledWith({
        _id: categoryId,
      });
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
      expect(mockProductModel.findById).not.toHaveBeenCalled();
      expect(mockProductModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException and remove new files if product not found before update', async () => {
      mockFindExisting(null);

      await expect(
        service.update(productId, dto, newFiles, adminId),
      ).rejects.toThrow(NotFoundException);
      expect(mockProductModel.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
    });

    it('should throw NotFoundException and remove new files if product not found after update', async () => {
      mockFindExisting({ images: oldImageUrls });
      mockProductModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(
        service.update(productId, dto, newFiles, adminId),
      ).rejects.toThrow(NotFoundException);
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
      expect(mockUnlink).not.toHaveBeenCalledWith(filePath(oldImageUrls[0]));
    });

    it('should throw NotFoundException without removing files if product not found and no files uploaded', async () => {
      mockProductModel.findByIdAndUpdate.mockResolvedValue(null);

      await expect(service.update(productId, dto, [], adminId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('should update a product when files is undefined', async () => {
      mockProductModel.findByIdAndUpdate.mockResolvedValue(mockProduct);

      const result = await service.update(
        productId,
        dto,
        undefined as unknown as Express.Multer.File[],
        adminId,
      );

      expect(mockProductModel.findById).not.toHaveBeenCalled();
      expect(mockProductModel.findByIdAndUpdate).toHaveBeenCalledWith(
        productId,
        { $set: dto },
        { new: true },
      );
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(result).toEqual(productResponse);
    });

    it('should throw ConflictException on duplicate key error and remove new files only', async () => {
      mockFindExisting({ images: oldImageUrls });
      mockProductModel.findByIdAndUpdate.mockRejectedValue({
        code: 11000,
      });

      await expect(
        service.update(productId, dto, newFiles, adminId),
      ).rejects.toThrow(ConflictException);
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
    });

    it('should rethrow unexpected update errors and remove new files', async () => {
      mockFindExisting({ images: oldImageUrls });
      mockProductModel.findByIdAndUpdate.mockRejectedValue(
        new Error('DB down'),
      );

      await expect(
        service.update(productId, dto, newFiles, adminId),
      ).rejects.toThrow('DB down');
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
    });
  });

  describe('Delete product', () => {
    it('should delete a product', async () => {
      mockProductModel.findByIdAndDelete.mockResolvedValue(mockProduct);

      const result = await service.remove(productId);

      expect(mockProductModel.findByIdAndDelete).toHaveBeenCalledWith(
        productId,
      );
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledWith(filePath(newImageUrls[0]));
      expect(result).toEqual({ message: 'Product deleted' });
    });

    it('should throw NotFoundException if product not found', async () => {
      mockProductModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.remove(productId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockProductModel.findByIdAndDelete).toHaveBeenCalledWith(
        productId,
      );
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('should delete a product that has no images', async () => {
      mockProductModel.findByIdAndDelete.mockResolvedValue({ images: [] });

      const result = await service.remove(productId);

      expect(mockUnlink).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Product deleted' });
    });

    it('should still delete product and log a warning if removing a file fails', async () => {
      mockProductModel.findByIdAndDelete.mockResolvedValue(mockProduct);
      mockUnlink.mockRejectedValue(new Error('ENOENT'));

      const result = await service.remove(productId);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to remove file new.png',
      );
      expect(result).toEqual({ message: 'Product deleted' });
    });
  });
});
