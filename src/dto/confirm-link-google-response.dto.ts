import { ApiProperty } from '@nestjs/swagger';

export class LinkConfirmationResponseDto {
  @ApiProperty({ example: true })
  requireLinkConfirmation: boolean;

  @ApiProperty({
    description: 'Token to send to POST /auth/google/confirm-link',
  })
  pendingLinkToken: string;
}
