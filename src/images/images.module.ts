import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { ImageEntity } from './image.entity';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([ImageEntity]), StorageModule],
  controllers: [ImagesController],
  providers: [ImagesService],
})
export class ImagesModule {}
