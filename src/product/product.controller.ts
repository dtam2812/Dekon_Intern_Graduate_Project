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
import { CleanupUploadedFilesFilter } from 'src/filter/cleanup-uploaded-files.filter';
import { ValidateImageFilesPipe } from 'src/pipe/validate-image-file.pipe';
import { ValidateObjectIdPipe } from 'src/pipe/validate-object-id.pipe';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(UserRole.ADMIN)
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
  findAll(@Query() query: FilterProductDto): Promise<any> {
    return this.productService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ValidateObjectIdPipe) id: string): Promise<Product> {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
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
  remove(
    @Param('id', ValidateObjectIdPipe) id: string,
  ): Promise<{ message: string }> {
    return this.productService.remove(id);
  }
}
