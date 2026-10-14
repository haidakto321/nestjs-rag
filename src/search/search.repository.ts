import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { readableParams, readableSql } from '../documents/visibility.js';
import type { ChunkMatch } from './search.types.js';

interface ChunkRow {
  chunk_id: string;
  document_id: string;
  title: string;
  heading_path: string;
  content: string;
  score: number | string;
}

const toMatch = (row: ChunkRow): ChunkMatch => ({
  chunkId: row.chunk_id,
  documentId: row.document_id,
  title: row.title,
  headingPath: row.heading_path,
  content: row.content,
  score: Number(row.score),
});

const toVectorLiteral = (vector: number[]) => `[${vector.join(',')}]`;

// TypeORM knows the `vector` column type but has no similarity API: this is where the ORM stops.
// The visibility rule is applied inside SQL, never filtered afterwards in TypeScript.
@Injectable()
export class SearchRepository {
  constructor(private readonly dataSource: DataSource) {}

  vector(user: AuthUser, embedding: number[], limit: number): Promise<ChunkMatch[]> {
    // HNSW returns its best candidates first and the permission filter runs after that.
    // strict_order iterative scan keeps scanning until LIMIT rows pass the filter (pgvector >= 0.8).
    // SET LOCAL needs a transaction, so this read gets an explicit one.
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SET LOCAL hnsw.iterative_scan = strict_order`);
      const rows: ChunkRow[] = await manager.query(
        `SELECT c.id AS chunk_id, c.document_id, d.title, c.heading_path, c.content,
                1 - (c.embedding <=> $1::vector) AS score
           FROM chunks c
           JOIN documents d ON d.id = c.document_id
          WHERE ${readableSql('d', 2)}
          ORDER BY c.embedding <=> $1::vector
          LIMIT $4`,
        // No tie-break column here: HNSW is only used when ORDER BY is the distance alone.
        [toVectorLiteral(embedding), ...readableParams(user), limit],
      );
      return rows.map(toMatch);
    });
  }

  async fts(user: AuthUser, query: string, limit: number): Promise<ChunkMatch[]> {
    const rows: ChunkRow[] = await this.dataSource.query(
      `SELECT c.id AS chunk_id, c.document_id, d.title, c.heading_path, c.content,
              ts_rank_cd(c.tsv, q) AS score
         FROM chunks c
         JOIN documents d ON d.id = c.document_id
        CROSS JOIN websearch_to_tsquery('english', $1) AS q
        WHERE c.tsv @@ q AND ${readableSql('d', 2)}
        ORDER BY score DESC, c.id
        LIMIT $4`,
      [query, ...readableParams(user), limit],
    );
    return rows.map(toMatch);
  }
}
