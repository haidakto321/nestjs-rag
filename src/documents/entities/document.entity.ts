import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const VISIBILITIES = ['private', 'public'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

// Named DocumentEntity because `Document` is a DOM global type. No TypeORM relations on purpose:
// nothing needs them, and ESM circular imports between entity files are then impossible.
@Entity({ name: 'documents' })
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  filename: string;

  @Column({ type: 'enum', enum: [...VISIBILITIES], enumName: 'document_visibility', default: 'private' })
  visibility: Visibility;

  @Column({ name: 'chunk_count', type: 'int' })
  chunkCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
