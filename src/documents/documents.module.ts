import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { uploadConfig } from '../config/app.config.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { ChunkEntity } from './entities/chunk.entity.js';
import { DocumentEntity } from './entities/document.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, ChunkEntity]),
    // Multer stops reading at the limit and Nest answers 413, before a huge file sits in memory.
    MulterModule.registerAsync({
      inject: [uploadConfig.KEY],
      useFactory: (upload: ConfigType<typeof uploadConfig>) => ({ limits: { fileSize: upload.maxBytes, files: 1 } }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
