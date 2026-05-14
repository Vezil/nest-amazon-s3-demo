import { ApiProperty } from '@nestjs/swagger';

export class ImageResponseDTO {
  @ApiProperty({ format: 'uuid', example: '7c3e1b2a-9d4f-4c1a-8b2e-3f6a5d8c1e90' })
  id: string;

  @ApiProperty({ example: 'cat sleeping' })
  title: string;

  @ApiProperty({
    example: 'http://localhost:9000/images/7c3e1b2a-9d4f-4c1a-8b2e-3f6a5d8c1e90.webp',
  })
  url: string;

  @ApiProperty({ example: 800 })
  width: number;

  @ApiProperty({ example: 600 })
  height: number;
}
