import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/enum/userRole.enum';

export class ProfileResponseDto {
  @ApiProperty({ example: '6aaca2fcf1a79a06b3023ea6' })
  sub: string;

  @ApiProperty({ example: 'nguyenductam658@gmail.com', required: false })
  email?: string;

  @ApiProperty({ example: 'Dinh Nguyen Duc Tam', required: false })
  fullName?: string;

  @ApiProperty({ enum: UserRole, required: false })
  role?: UserRole;
}
