import { ApiProperty } from '@nestjs/swagger';
import { ImageResponseDTO } from './image-response.dto';

class PaginationMetaDTO {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedImagesResponseDTO {
  @ApiProperty({ type: [ImageResponseDTO] })
  data: ImageResponseDTO[];

  @ApiProperty({ type: PaginationMetaDTO })
  meta: PaginationMetaDTO;
}
