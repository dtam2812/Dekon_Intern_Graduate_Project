import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from 'src/enum/userRole.enum';

export class UpdateUserAdminDto {
  @ApiProperty({
    enum: UserRole,
    enumName: 'UserRole',
    description: "User's role, include customer, staff, admin",
    example: 'customer',
  })
  @IsEnum(UserRole, {
    message: `User role must be one of: ${Object.values(UserRole).join(', ')}`,
  })
  role!: UserRole;
}
