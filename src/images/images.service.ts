import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageEntity } from './image.entity';
import { StorageService } from '../storage/storage.service';
import { CreateImageDto } from './dto/create-image.dto';
import sharp from 'sharp';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(ImageEntity)
    private repo: Repository<ImageEntity>,
    private storageService: StorageService,
  ) {}

  async upload(file: Express.Multer.File, dto: CreateImageDto) {
    const processed = await sharp(file.buffer)
      .resize(dto.width, dto.height, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const { key, url } = await this.storageService.uploadFile(processed, 'image/webp');

    const image = this.repo.create({
      title: dto.title,
      url,
      storageKey: key,
      width: dto.width,
      height: dto.height,
      mimeType: 'image/webp',
    });

    return this.repo.save(image);
  }
}
