import { NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import sharp from 'sharp';
import { ImagesService } from './images.service';
import { ImageEntity } from './image.entity';
import { StorageService } from '../storage/storage.service';
import { CreateImageDTO } from './dto/create-image.dto';
import { GetImagesQueryDTO } from './dto/get-images-query.dto';

describe('ImagesService', () => {
  let service: ImagesService;
  let repo: { createQueryBuilder: jest.Mock; findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let storage: { uploadFile: jest.Mock; safeDeleteFile: jest.Mock };
  let pngBuffer: Buffer;

  const dto: CreateImageDTO = { title: 't', width: 10, height: 10 };

  beforeAll(async () => {
    pngBuffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
  });

  beforeEach(() => {
    repo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };
    dataSource = { transaction: jest.fn() };
    storage = {
      uploadFile: jest.fn(),
      safeDeleteFile: jest.fn().mockResolvedValue(undefined),
    };

    service = new ImagesService(
      repo as unknown as Repository<ImageEntity>,
      dataSource as unknown as DataSource,
      storage as unknown as StorageService,
    );
  });

  describe('upload', () => {
    const file = { buffer: undefined as unknown as Buffer } as Express.Multer.File;

    beforeEach(() => {
      file.buffer = pngBuffer;
    });

    it('calls safeDeleteFile with the uploaded key when the DB transaction throws', async () => {
      storage.uploadFile.mockResolvedValue({ key: 'orphan.webp', url: 'http://x/orphan.webp' });
      dataSource.transaction.mockRejectedValue(new Error('DB down'));

      await expect(service.upload(file, dto)).rejects.toThrow('DB down');

      expect(storage.safeDeleteFile).toHaveBeenCalledTimes(1);
      expect(storage.safeDeleteFile).toHaveBeenCalledWith('orphan.webp');
    });

    it('does not call safeDeleteFile on the happy path', async () => {
      storage.uploadFile.mockResolvedValue({ key: 'ok.webp', url: 'http://x/ok.webp' });
      dataSource.transaction.mockResolvedValue({ id: 'i1' });

      await service.upload(file, dto);

      expect(storage.safeDeleteFile).not.toHaveBeenCalled();
    });

    it('does not persist or attempt cleanup when S3 upload itself fails', async () => {
      storage.uploadFile.mockRejectedValue(new Error('S3 down'));

      await expect(service.upload(file, dto)).rejects.toThrow('S3 down');

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(storage.safeDeleteFile).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when id is unknown', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('projects only the public response shape (no storageKey, mimeType, timestamps)', async () => {
      repo.findOne.mockResolvedValue({
        id: 'i1',
        url: 'u',
        title: 't',
        width: 100,
        height: 200,
        storageKey: 'internal.webp',
        mimeType: 'image/webp',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findOne('i1');

      expect(result).toEqual({ id: 'i1', url: 'u', title: 't', width: 100, height: 200 });
    });
  });

  describe('findAll', () => {
    function buildQueryBuilder(rows: unknown[], total: number) {
      return {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
      };
    }

    it('computes skip = (page-1)*limit and totalPages = ceil(total/limit)', async () => {
      const qb = buildQueryBuilder([], 25);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 3, limit: 10 } as GetImagesQueryDTO);

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
    });

    it('reports totalPages = 0 when there are no rows', async () => {
      const qb = buildQueryBuilder([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ page: 1, limit: 10 } as GetImagesQueryDTO);

      expect(result.meta.totalPages).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('omits the ILIKE filter when title is not provided', async () => {
      const qb = buildQueryBuilder([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({} as GetImagesQueryDTO);

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('applies ILIKE with % wildcards when title is provided', async () => {
      const qb = buildQueryBuilder([], 0);
      repo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ title: 'cat' } as GetImagesQueryDTO);

      expect(qb.where).toHaveBeenCalledWith('image.title ILIKE :title', { title: '%cat%' });
    });

    it('strips storageKey/mimeType from list items', async () => {
      const qb = buildQueryBuilder(
        [
          {
            id: 'i1',
            url: 'u',
            title: 't',
            width: 1,
            height: 2,
            storageKey: 'secret.webp',
            mimeType: 'image/webp',
          },
        ],
        1,
      );
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({} as GetImagesQueryDTO);

      expect(result.data[0]).toEqual({ id: 'i1', url: 'u', title: 't', width: 1, height: 2 });
    });
  });
});
