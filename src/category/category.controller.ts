import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from 'src/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/dto/update-category.dto';
import { Roles } from 'src/decorator/role.decorator';
import { UserRole } from 'src/enum/userRole.enum';
import { Public } from 'src/decorator/public.decorator';
import { Category } from 'src/schemas/category.schema';
import { ValidateObjectIdPipe } from 'src/pipe/validate-object-id.pipe';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new category, admin only',
    description: 'Creates a new category. Only accessible by administrators.',
  })
  @ApiCreatedResponse({
    type: Category,
    description: 'Category successfully created',
  })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiConflictResponse({
    description: 'This [field] existed (e.g. name or slug)',
  })
  create(@Body() createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(createCategoryDto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Retrieves a list of all categories.',
  })
  @ApiOkResponse({
    type: Category,
    isArray: true,
    description: 'Successfully retrieved list of categories',
  })
  findAll(): Promise<Category[]> {
    return this.categoryService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get category by id',
    description: 'Finds a specific category by its ID.',
  })
  @ApiOkResponse({
    type: Category,
    description: 'Successfully retrieved category details',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiNotFoundResponse({ description: 'Category not found' })
  findOne(@Param('id', ValidateObjectIdPipe) id: string): Promise<Category> {
    return this.categoryService.findOne(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a category, admin only',
    description:
      'Updates a category by its ID. Only accessible by administrators.',
  })
  @ApiOkResponse({
    type: Category,
    description: 'Successfully updated category',
  })
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId or Body)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({
    description: 'This [field] existed (e.g. name or slug)',
  })
  update(
    @Param('id', ValidateObjectIdPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a category, admin only',
    description:
      'Deletes a category by its ID. Only accessible by administrators.',
  })
  @ApiOkResponse({ description: 'Category successfully deleted' })
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  remove(
    @Param('id', ValidateObjectIdPipe) id: string,
  ): Promise<{ message: string }> {
    return this.categoryService.remove(id);
  }
}
