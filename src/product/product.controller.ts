import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Req,
  BadRequestException,
  Query,
  UseFilters,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from 'src/dto/create-product.dto';
import { UpdateProductDto } from 'src/dto/update-product.dto';
import { Roles } from 'src/decorator/role.decorator';
import { UserRole } from 'src/enum/userRole.enum';
import { Public } from 'src/decorator/public.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Product } from 'src/schemas/product.schema';
import { storageConfig } from 'src/helpers/config';
import { extname } from 'path';
import { FilterProductDto } from 'src/dto/filter-product.dto';
import { PaginatedResponseDto } from 'src/dto/paginated-response.dto';
import { CleanupUploadedFilesFilter } from 'src/filter/cleanup-uploaded-files.filter';
import { ValidateImageFilesPipe } from 'src/pipe/validate-image-file.pipe';
import { ValidateObjectIdPipe } from 'src/pipe/validate-object-id.pipe';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  getSchemaPath,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedData,
  ApiOkData,
  ApiPaginatedData,
} from 'src/decorator/api-data-response.decorator';
import { MessageResponseDto } from 'src/dto/message-response.dto';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new product, admin only',
    description:
      'Creates a new product. Requires 1-5 images. Only accessible by administrators.',
  })
  @ApiCreatedData(Product, 'Product successfully created')
  @ApiBadRequestResponse({
    description:
      'Validation failed / Product must have images / Only accept images with .jpg, .jpeg, .png',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'This [field] existed' })
  @Roles(UserRole.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiExtraModels(CreateProductDto)
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(CreateProductDto) },
        {
          type: 'object',
          required: ['images'],
          properties: {
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
              description:
                '1-5 files, .jpg/.jpeg/.png, max 5MB each. Click "Add string item" once per image.',
            },
          },
        },
      ],
    },
  })
  @UseFilters(CleanupUploadedFilesFilter)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: storageConfig('images'),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(ext)) cb(null, true);
        else
          cb(
            new BadRequestException(
              'Only accept images with .jpg, .jpeg, .png',
            ),
            false,
          );
      },
    }),
  )
  create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles(ValidateImageFilesPipe) files: Express.Multer.File[],
    @Req() req,
  ): Promise<Product> {
    if (!files?.length)
      throw new BadRequestException('Product must have images');
    return this.productService.create(createProductDto, files, req.user.sub);
  }

  @Public()
  @Get()
  @ApiPaginatedData(Product, 'Successfully retrieved products')
  @ApiOperation({
    summary: 'Get all products',
    description:
      'Retrieves a paginated list of all products with optional filters.',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  findAll(@Query() query: FilterProductDto): Promise<any> {
    return this.productService.findAll(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Find product by id',
    description: 'Finds a specific product by its ID.',
  })
  @ApiOkData(Product, 'Successfully retrieved product details')
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findOne(@Param('id', ValidateObjectIdPipe) id: string): Promise<Product> {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update a product's information, admin only",
    description:
      "Updates a product's information and/or images by its ID. Only accessible by administrators.",
  })
  @ApiOkData(Product, 'Successfully updated product')
  @ApiBadRequestResponse({
    description:
      'Validation failed / Only accept images with .jpg, .jpeg, .png',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({
    description: 'Category not found / Product not found',
  })
  @ApiConflictResponse({ description: 'This [field] existed' })
  @ApiConsumes('multipart/form-data')
  @ApiExtraModels(UpdateProductDto)
  @ApiBody({
    schema: {
      allOf: [
        { $ref: getSchemaPath(UpdateProductDto) },
        {
          type: 'object',
          properties: {
            images: {
              type: 'array',
              items: { type: 'string', format: 'binary' },
              description:
                '1-5 files, .jpg/.jpeg/.png, max 5MB each. Click "Add string item" once per image.',
            },
          },
        },
      ],
    },
  })
  @UseFilters(CleanupUploadedFilesFilter)
  @UseInterceptors(
    FilesInterceptor('images', 5, {
      storage: storageConfig('images'),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png'].includes(ext)) cb(null, true);
        else
          cb(
            new BadRequestException(
              'Only accept images with .jpg, .jpeg, .png',
            ),
            false,
          );
      },
    }),
  )
  update(
    @Param('id', ValidateObjectIdPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles(ValidateImageFilesPipe) files: Express.Multer.File[],
    @Req() req,
  ): Promise<Product> {
    return this.productService.update(
      id,
      updateProductDto,
      files,
      req.user.sub,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a product, admin only',
    description:
      'Deletes a product by its ID. Only accessible by administrators.',
  })
  @ApiOkData(MessageResponseDto, 'Product successfully deleted')
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  remove(
    @Param('id', ValidateObjectIdPipe) id: string,
  ): Promise<{ message: string }> {
    return this.productService.remove(id);
  }
}
