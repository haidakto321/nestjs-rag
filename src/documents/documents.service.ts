import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type FindOptionsWhere, type Repository } from 'typeorm';
import { EMBEDDING_PROVIDER } from '../ai/ai.tokens.js';
import type { EmbeddingProvider } from '../ai/embedding/embedding-provider.js';
import type { AuthUser } from '../auth/auth-user.js';
import { CONSTRAINT_MESSAGES } from '../common/filters/app-exception.filter.js';
import { chunkText, extractTitle, stripExtension, type TextKind } from './chunker.js';
import { ChunkEntity } from './entities/chunk.entity.js';
import { DocumentEntity, type Visibility } from './entities/document.entity.js';
import type { UploadedTextFile } from './uploaded-file.js';
import { canDelete, canRead } from './visibility.js';

export interface UploadResult {
  id: string;
  title: string;
  chunkCount: number;
}

export interface DocumentDetail extends DocumentEntity {
  chunks: Array<{ index: number; headingPath: string; preview: string }>;
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DocumentEntity) private readonly documents: Repository<DocumentEntity>,
    @InjectRepository(ChunkEntity) private readonly chunks: Repository<ChunkEntity>,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  async ingest(user: AuthUser, file: UploadedTextFile, visibility: Visibility): Promise<UploadResult> {
    const text = decodeText(file.buffer);
    const kind: TextKind = file.originalname.toLowerCase().endsWith('.md') ? 'markdown' : 'text';
    const pieces = chunkText(text, kind);
    if (pieces.length === 0) throw new BadRequestException('The file has no text to index');
    const title = kind === 'markdown' ? extractTitle(text, file.originalname) : stripExtension(file.originalname);

    // Cheap early answer, so a duplicate does not wait minutes for embeddings first. Two uploads at
    // the same moment can both pass this check; the unique constraint still stops the second one.
    if (await this.documents.existsBy({ ownerId: user.id, filename: file.originalname })) {
      throw new ConflictException(CONSTRAINT_MESSAGES.documents_owner_filename_key);
    }

    // Slow network work first, outside any transaction, so no transaction waits on Ollama.
    const vectors = await this.embeddings.embed(pieces.map((piece) => piece.content));

    // One explicit transaction: the document and all of its chunks are stored together, or not at all.
    return this.dataSource.transaction(async (manager) => {
      const doc = await manager.save(
        manager.create(DocumentEntity, {
          ownerId: user.id,
          title,
          filename: file.originalname,
          visibility,
          chunkCount: pieces.length,
        }),
      );
      await manager.insert(
        ChunkEntity,
        pieces.map((piece, i) => ({
          documentId: doc.id,
          chunkIndex: piece.index,
          headingPath: piece.headingPath,
          content: piece.content,
          embedding: vectors[i],
        })),
      );
      return { id: doc.id, title: doc.title, chunkCount: pieces.length };
    });
  }

  /** Own plus public documents; admins see all. An array `where` is TypeORM's OR. */
  list(user: AuthUser): Promise<DocumentEntity[]> {
    const where: FindOptionsWhere<DocumentEntity> | FindOptionsWhere<DocumentEntity>[] =
      user.role === 'admin' ? {} : [{ visibility: 'public' }, { ownerId: user.id }];
    return this.documents.find({ where, order: { createdAt: 'DESC' } });
  }

  async getDetail(user: AuthUser, id: string): Promise<DocumentDetail> {
    const doc = await this.getReadable(user, id);
    const chunks = await this.chunks.find({ where: { documentId: id }, order: { chunkIndex: 'ASC' } });
    return {
      ...doc,
      chunks: chunks.map((c) => ({ index: c.chunkIndex, headingPath: c.headingPath, preview: c.content.slice(0, 200) })),
    };
  }

  async delete(user: AuthUser, id: string): Promise<void> {
    const doc = await this.getReadable(user, id);
    if (!canDelete(user, doc)) throw new ForbiddenException('Only the owner or an admin can delete this document');
    await this.documents.delete({ id }); // chunks follow through ON DELETE CASCADE
  }

  // "Not readable" and "does not exist" look the same to the caller: both 404.
  private async getReadable(user: AuthUser, id: string): Promise<DocumentEntity> {
    const doc = await this.documents.findOneBy({ id });
    if (!doc || !canRead(user, doc)) throw new NotFoundException('Document not found');
    return doc;
  }
}

function decodeText(buffer: Buffer): string {
  let text: string;
  try {
    text = utf8.decode(buffer); // also drops a leading BOM
  } catch {
    throw new BadRequestException('The file is not valid UTF-8 text');
  }
  // Valid UTF-8 can contain NUL, but Postgres text cannot store it.
  if (text.includes('\u0000')) throw new BadRequestException('The file contains binary data (NUL bytes)');
  return text;
}
