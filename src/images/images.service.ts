import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import sharp from 'sharp';
import { ImageEntity } from './image.entity';
import { StorageService } from '../storage/storage.service';
import { CreateImageDto } from './dto/create-image.dto';
import { NotFoundException } from '@nestjs/common';
import { GetImagesQueryDto } from './dto/get-images-query.dto';

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

  async findAll(query: GetImagesQueryDto) {
    const { title, page = 1, limit = 10 } = query;

    const qb = this.repo.createQueryBuilder('image');

    if (title) {
      qb.where('image.title ILIKE :title', { title: `%${title}%` });
    }

    qb.orderBy('image.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((image) => ({
        id: image.id,
        url: image.url,
        title: image.title,
        width: image.width,
        height: image.height,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const image = await this.repo.findOne({ where: { id } });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    return {
      id: image.id,
      url: image.url,
      title: image.title,
      width: image.width,
      height: image.height,
    };
  }
}
