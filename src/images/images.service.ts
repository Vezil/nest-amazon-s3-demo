import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import sharp from 'sharp';
import { ImageEntity } from './image.entity';
import { StorageService } from '../storage/storage.service';
import { CreateImageDTO } from './dto/create-image.dto';
import { GetImagesQueryDTO } from './dto/get-images-query.dto';

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(ImageEntity)
    private repo: Repository<ImageEntity>,
    @InjectDataSource()
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async upload(file: Express.Multer.File, dto: CreateImageDTO) {
    const processed = await sharp(file.buffer)
      .resize(dto.width, dto.height, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();

    const { key, url } = await this.storageService.uploadFile(processed, 'image/webp');

    try {
      return await this.dataSource.transaction(async (manager) => {
        const image = manager.create(ImageEntity, {
          title: dto.title,
          url,
          storageKey: key,
          width: dto.width,
          height: dto.height,
          mimeType: 'image/webp',
        });
        return manager.save(image);
      });
    } catch (err) {
      await this.storageService.safeDeleteFile(key);
      throw err;
    }
  }

  async findAll(query: GetImagesQueryDTO) {
    const { title, page = 1, limit = 10 } = query;

    const queryBuilder = this.repo.createQueryBuilder('image');

    if (title) {
      queryBuilder.where('image.title ILIKE :title', { title: `%${title}%` });
    }

    queryBuilder.orderBy('image.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit);
    queryBuilder.take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

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
