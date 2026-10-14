import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from '../support/create-test-app.js';

describe('database (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs pending migrations at boot', async () => {
    const rows: Array<{ name: string }> = await app
      .get(DataSource)
      .query('SELECT name FROM migrations ORDER BY id');
    expect(rows.map((r) => r.name)).toContain('InitExtensions1760400000000');
  });

  it('has the pgvector extension installed', async () => {
    const rows = await app
      .get(DataSource)
      .query(`SELECT extname FROM pg_extension WHERE extname = 'vector'`);
    expect(rows).toHaveLength(1);
  });

  it('creates chunks with vector(768), a generated tsv column and both search indexes', async () => {
    const ds = app.get(DataSource);
    const [embedding] = await ds.query(
      `SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute
        WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'`,
    );
    expect(embedding.type).toBe('vector(768)');
    const [tsv] = await ds.query(
      `SELECT is_generated FROM information_schema.columns WHERE table_name = 'chunks' AND column_name = 'tsv'`,
    );
    expect(tsv.is_generated).toBe('ALWAYS');
    const indexes: Array<{ indexname: string }> = await ds.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'chunks'`,
    );
    expect(indexes.map((i) => i.indexname)).toEqual(
      expect.arrayContaining(['chunks_embedding_hnsw_idx', 'chunks_tsv_gin_idx']),
    );
  });
});
