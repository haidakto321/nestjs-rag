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
});
