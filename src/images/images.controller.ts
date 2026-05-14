import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImagesService } from './images.service';
import {
  ApiBody,
  ApiConsumes,
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiParam,
} from '@nestjs/swagger';
import { GetImagesQueryDTO } from './dto/get-images-query.dto';
import { CreateImageDTO } from './dto/create-image.dto';
import { ImageResponseDTO } from './dto/image-response.dto';
import { PaginatedImagesResponseDTO } from './dto/paginated-images-response.dto';

const MAX_FILE_SIZE = 5 * 1024 * 1024;

@ApiTags('Images')
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an image, resize it, store in S3, persist metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (image/*). Max 5 MB.',
        },
        title: { type: 'string', example: 'cat sleeping', minLength: 1, maxLength: 255 },
        width: { type: 'integer', example: 800, minimum: 1, maximum: 10000 },
        height: { type: 'integer', example: 600, minimum: 1, maximum: 10000 },
      },
      required: ['file', 'title', 'width', 'height'],
    },
  })
  @ApiCreatedResponse({ type: ImageResponseDTO })
  @ApiBadRequestResponse({ description: 'Validation failed or unsupported file type' })
  @ApiPayloadTooLargeResponse({ description: 'File exceeds 5 MB' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /^image\// }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: CreateImageDTO,
  ) {
    return this.imagesService.upload(file, body);
  }

  @Get()
  @ApiOperation({ summary: 'Paginated list of images, optionally filtered by title' })
  @ApiOkResponse({ type: PaginatedImagesResponseDTO })
  findAll(@Query() query: GetImagesQueryDTO) {
    return this.imagesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single image by id' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ImageResponseDTO })
  @ApiBadRequestResponse({ description: 'id is not a valid UUID' })
  @ApiNotFoundResponse({ description: 'Image not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.imagesService.findOne(id);
  }
}
