import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { StorageService } from './storage.service';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn((input: unknown) => ({ __cmd: 'Put', input })),
  DeleteObjectCommand: jest.fn((input: unknown) => ({ __cmd: 'Delete', input })),
}));

describe('StorageService', () => {
  const env: Record<string, string> = {
    S3_BUCKET: 'images',
    S3_REGION: 'us-east-1',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'minio',
    S3_SECRET_KEY: 'minio123',
  };

  const configService = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  let service: StorageService;

  beforeEach(() => {
    sendMock.mockReset();
    service = new StorageService(configService);
  });

  describe('uploadFile', () => {
    it('returns a .webp key and a URL formed as <endpoint>/<bucket>/<key>', async () => {
      sendMock.mockResolvedValue({});

      const { key, url } = await service.uploadFile(Buffer.from('payload'), 'image/webp');

      expect(key).toMatch(/^[0-9a-f-]+\.webp$/);
      expect(url).toBe(`http://localhost:9000/images/${key}`);
      expect(sendMock).toHaveBeenCalledTimes(1);
    });

    it('propagates S3 errors so callers can compensate', async () => {
      sendMock.mockRejectedValue(new Error('NoSuchBucket'));

      await expect(service.uploadFile(Buffer.from('x'), 'image/webp')).rejects.toThrow(
        'NoSuchBucket',
      );
    });
  });

  describe('deleteFile', () => {
    it('propagates S3 errors', async () => {
      sendMock.mockRejectedValue(new Error('AccessDenied'));

      await expect(service.deleteFile('a.webp')).rejects.toThrow('AccessDenied');
    });
  });

  describe('safeDeleteFile', () => {
    it('swallows errors — required so the compensating cleanup in ImagesService never masks the original error', async () => {
      sendMock.mockRejectedValue(new Error('boom'));
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

      await expect(service.safeDeleteFile('orphan.webp')).resolves.toBeUndefined();
      expect(loggerSpy).toHaveBeenCalled();

      loggerSpy.mockRestore();
    });

    it('deletes on the happy path', async () => {
      sendMock.mockResolvedValue({});

      await service.safeDeleteFile('orphan.webp');

      expect(sendMock).toHaveBeenCalledTimes(1);
    });
  });
});
