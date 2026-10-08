import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmLinkGoogleDto {
  @ApiProperty({
    description: 'Temporary token used for authentication',
  })
  @IsString()
  @IsNotEmpty()
  pendingLinkToken: string;

  @ApiProperty({ description: 'Password of your local account' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
