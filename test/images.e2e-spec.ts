import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/storage/storage.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ImageEntity } from '../src/images/image.entity';
import 'dotenv/config';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:9000';

describe('ImagesController (e2e)', () => {
  let app: INestApplication;
  let imageRepository: Repository<ImageEntity>;

  const storageServiceMock = {
    uploadFile: jest.fn().mockResolvedValue({
      key: 'test-file.webp',
      url: `${BASE_URL}/images/test-file.webp`,
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    safeDeleteFile: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StorageService)
      .useValue(storageServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    imageRepository = moduleFixture.get<Repository<ImageEntity>>(getRepositoryToken(ImageEntity));
  });

  beforeEach(async () => {
    storageServiceMock.uploadFile.mockClear();
    await imageRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /images should upload and save image metadata', async () => {
    const pngBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const response = await request(app.getHttpServer())
      .post('/images')
      .field('title', 'test image')
      .field('width', '100')
      .field('height', '100')
      .attach('file', pngBuffer, {
        filename: 'test.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: 'test image',
        url: `${BASE_URL}/images/test-file.webp`,
        width: 100,
        height: 100,
        mimeType: 'image/webp',
      }),
    );

    expect(storageServiceMock.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('GET /images should return paginated list', async () => {
    await imageRepository.save([
      imageRepository.create({
        title: 'cat one',
        url: `${BASE_URL}/images/1.webp`,
        storageKey: '1.webp',
        width: 100,
        height: 100,
        mimeType: 'image/webp',
      }),
      imageRepository.create({
        title: 'dog two',
        url: `${BASE_URL}/images/2.webp`,
        storageKey: '2.webp',
        width: 200,
        height: 200,
        mimeType: 'image/webp',
      }),
    ]);

    const response = await request(app.getHttpServer()).get('/images?page=1&limit=10').expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        data: expect.any(Array),
        meta: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      }),
    );

    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: expect.any(String),
        url: expect.any(String),
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
  });

  it('GET /images should filter by title', async () => {
    await imageRepository.save([
      imageRepository.create({
        title: 'cat alpha',
        url: `${BASE_URL}/images/1.webp`,
        storageKey: '1.webp',
        width: 100,
        height: 100,
        mimeType: 'image/webp',
      }),
      imageRepository.create({
        title: 'dog beta',
        url: `${BASE_URL}/images/2.webp`,
        storageKey: '2.webp',
        width: 200,
        height: 200,
        mimeType: 'image/webp',
      }),
    ]);

    const response = await request(app.getHttpServer()).get('/images?title=cat').expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('cat alpha');
  });

  it('GET /images/:id should return single image', async () => {
    const imageTitle = 'single image';

    const image = await imageRepository.save(
      imageRepository.create({
        title: imageTitle,
        url: `${BASE_URL}/images/single.webp`,
        storageKey: 'single.webp',
        width: 300,
        height: 200,
        mimeType: 'image/webp',
      }),
    );

    const response = await request(app.getHttpServer()).get(`/images/${image.id}`).expect(200);

    expect(response.body).toEqual({
      id: image.id,
      title: imageTitle,
      url: `${BASE_URL}/images/single.webp`,
      width: 300,
      height: 200,
    });
  });

  it('GET /images/:id should return 404 for missing image', async () => {
    const fakeId = '11111111-1111-1111-1111-111111111111';

    await request(app.getHttpServer()).get(`/images/${fakeId}`).expect(404);
  });

  it('GET /images/:id should return 400 for non-UUID id', async () => {
    await request(app.getHttpServer()).get('/images/not-a-uuid').expect(400);
  });

  describe('POST /images validation', () => {
    let pngBuffer: Buffer;

    beforeAll(async () => {
      pngBuffer = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toBuffer();
    });

    it('rejects non-image MIME type', async () => {
      await request(app.getHttpServer())
        .post('/images')
        .field('title', 'x')
        .field('width', '100')
        .field('height', '100')
        .attach('file', Buffer.from('not an image'), {
          filename: 'doc.txt',
          contentType: 'text/plain',
        })
        .expect(400);

      expect(storageServiceMock.uploadFile).not.toHaveBeenCalled();
      expect(await imageRepository.count()).toBe(0);
    });

    it('rejects width above MAX_DIMENSION', async () => {
      await request(app.getHttpServer())
        .post('/images')
        .field('title', 'x')
        .field('width', '10001')
        .field('height', '100')
        .attach('file', pngBuffer, { filename: 'x.png', contentType: 'image/png' })
        .expect(400);

      expect(storageServiceMock.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects missing title', async () => {
      await request(app.getHttpServer())
        .post('/images')
        .field('width', '100')
        .field('height', '100')
        .attach('file', pngBuffer, { filename: 'x.png', contentType: 'image/png' })
        .expect(400);
    });

    it('rejects extra fields (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .post('/images')
        .field('title', 'x')
        .field('width', '100')
        .field('height', '100')
        .field('isPublic', 'true')
        .attach('file', pngBuffer, { filename: 'x.png', contentType: 'image/png' })
        .expect(400);
    });
  });

  describe('POST /images rollback', () => {
    it('does not persist a DB row when S3 upload fails', async () => {
      storageServiceMock.uploadFile.mockRejectedValueOnce(new Error('S3 down'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      const pngBuffer = await sharp({
        create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toBuffer();

      await request(app.getHttpServer())
        .post('/images')
        .field('title', 'fails')
        .field('width', '100')
        .field('height', '100')
        .attach('file', pngBuffer, { filename: 'x.png', contentType: 'image/png' })
        .expect(500);

      expect(await imageRepository.count()).toBe(0);

      loggerSpy.mockRestore();
    });
  });

  describe('GET /images query validation', () => {
    it('rejects limit above max', async () => {
      await request(app.getHttpServer()).get('/images?limit=101').expect(400);
    });

    it('rejects page below 1', async () => {
      await request(app.getHttpServer()).get('/images?page=0').expect(400);
    });
  });
});
