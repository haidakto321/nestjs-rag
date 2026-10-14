import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DocumentsService, type DocumentDetail, type UploadResult } from './documents.service.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { VISIBILITIES, type DocumentEntity } from './entities/document.entity.js';
import { FileExtensionValidator } from './file-extension.validator.js';
import type { UploadedTextFile } from './uploaded-file.js';

const ALLOWED_EXTENSIONS = ['.md', '.txt'];

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        visibility: { type: 'string', enum: [...VISIBILITIES], default: 'private' },
      },
    },
  })
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile(new ParseFilePipe({ validators: [new FileExtensionValidator({ extensions: ALLOWED_EXTENSIONS })] }))
    file: UploadedTextFile,
    @Body() dto: UploadDocumentDto,
  ): Promise<UploadResult> {
    return this.documents.ingest(user, file, dto.visibility ?? 'private');
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<DocumentEntity[]> {
    return this.documents.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<DocumentDetail> {
    return this.documents.getDetail(user, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.documents.delete(user, id);
  }
}
