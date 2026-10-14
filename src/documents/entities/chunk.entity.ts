import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// The generated `tsv` column exists only in SQL (migration and SearchRepository).
@Entity({ name: 'chunks' })
export class ChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex: number;

  @Column({ name: 'heading_path', type: 'text', default: '' })
  headingPath: string;

  @Column({ type: 'text' })
  content: string;

  // Written on insert, never loaded: 768 floats per row would bloat every read.
  @Column({ type: 'vector', length: 768, select: false })
  embedding: number[];
}
