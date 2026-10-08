import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserResponseDto } from 'src/dto/user-response.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { Roles } from 'src/decorator/role.decorator';
import { UserRole } from 'src/enum/userRole.enum';
import { UpdateUserAdminDto } from 'src/dto/update-user-admin.dto';
import { ValidateObjectIdPipe } from 'src/pipe/validate-object-id.pipe';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  ApiCreatedData,
  ApiOkData,
} from 'src/decorator/api-data-response.decorator';
import { MessageResponseDto } from 'src/dto/message-response.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new user account, admin only',
    description:
      'Creates a new user account. Only accessible by administrators.',
  })
  @ApiCreatedData(UserResponseDto, 'User successfully created')
  @ApiBadRequestResponse({
    description: 'Validation failed / Password is required',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiConflictResponse({ description: 'This email has been used' })
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all users, admin and staff only',
    description:
      'Retrieves a list of all users. Accessible by administrators and staff.',
  })
  @ApiOkData(UserResponseDto, 'Successfully retrieved list of users', true)
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  findAll(): Promise<UserResponseDto[]> {
    return this.userService.findAll();
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Find user by id, admin and staff only',
    description:
      'Finds a specific user by their ID. Accessible by administrators and staff.',
  })
  @ApiOkData(UserResponseDto, 'Successfully retrieved user details')
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'user not found' })
  findOne(@Param('id', ValidateObjectIdPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch('updateInfo')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update current user's information",
    description: "Updates the currently authenticated user's own information.",
  })
  @ApiOkData(UserResponseDto, 'Successfully updated user information')
  @ApiBadRequestResponse({
    description:
      'Validation failed / Current password is required or incorrect / Google accounts cannot change email or password',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiConflictResponse({ description: 'Email already in use' })
  update(@Req() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(req.user.sub, updateUserDto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update user's role by id (admin only)",
    description:
      "Updates another user's role by their ID. Only accessible by administrators, who cannot change their own role.",
  })
  @ApiOkData(UserResponseDto, "Successfully updated user's role")
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId or Body)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Not an admin / Admins cannot change their own role',
  })
  @ApiNotFoundResponse({ description: 'User not found' })
  updateAdmin(
    @Param('id', ValidateObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserAdminDto,
    @Req() req: any,
  ) {
    return this.userService.updateAdmin(id, updateUserDto, req.user.sub);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a user account, admin only',
    description:
      'Deletes a user account by their ID. Only accessible by administrators.',
  })
  @Roles(UserRole.ADMIN)
  @ApiOkData(MessageResponseDto, 'User successfully deleted')
  @ApiBadRequestResponse({
    description: 'Validation failed (Invalid ObjectId)',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden resource' })
  @ApiNotFoundResponse({ description: 'user not found' })
  remove(@Param('id', ValidateObjectIdPipe) id: string) {
    return this.userService.remove(id);
  }
}
