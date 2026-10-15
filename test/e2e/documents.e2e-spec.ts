import { ServiceUnavailableException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens.js';
import { uploadConfig } from '../../src/config/app.config.js';
import type { Visibility } from '../../src/documents/entities/document.entity.js';
import { bearer, createAdminAndLogin, registerAndLogin } from '../support/auth-helpers.js';
import { createTestApp } from '../support/create-test-app.js';
import { uploadText } from '../support/document-helpers.js';
import { resetDatabase } from '../support/reset-database.js';

const countDocuments = async (app: INestApplication): Promise<number> =>
  (await app.get(DataSource).query('SELECT count(*)::int AS n FROM documents'))[0].n;

describe('documents upload (e2e)', () => {
  let app: INestApplication;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerAndLogin(app, 'alice@test.io');
    bob = await registerAndLogin(app, 'bob@test.io');
  });

  afterAll(async () => {
    await app.close();
  });

  it('indexes markdown: title from the H1, chunks with embedding and tsv', async () => {
    const res = await uploadText(app, alice, 'guide.md', '# Install Guide\nUse docker.\n\n## Ports\nPostgres listens on 5433.').expect(201);
    expect(res.body).toEqual({ id: expect.any(String), title: 'Install Guide', chunkCount: 2 });
    const rows = await app.get(DataSource).query(
      `SELECT chunk_index, heading_path, embedding IS NOT NULL AS has_embedding, tsv IS NOT NULL AS has_tsv
         FROM chunks WHERE document_id = $1 ORDER BY chunk_index`,
      [res.body.id],
    );
    expect(rows).toEqual([
      { chunk_index: 0, heading_path: 'Install Guide', has_embedding: true, has_tsv: true },
      { chunk_index: 1, heading_path: 'Install Guide > Ports', has_embedding: true, has_tsv: true },
    ]);
  });

  it('uses the filename as title for .txt files', async () => {
    const res = await uploadText(app, alice, 'meeting-notes.txt', 'Plain text.\n\nSecond paragraph.').expect(201);
    expect(res.body).toMatchObject({ title: 'meeting-notes', chunkCount: 1 });
  });

  it('keeps a non-ASCII (Vietnamese) filename intact', async () => {
    const res = await uploadText(app, alice, 'ghi-chú.txt', 'Nội dung cuộc họp.').expect(201);
    expect(res.body.title).toBe('ghi-chú');
    const [row] = await app.get(DataSource).query('SELECT filename FROM documents WHERE id = $1', [res.body.id]);
    expect(row.filename).toBe('ghi-chú.txt');
  });

  it('returns 409 for the same filename twice for one user, but allows it for another user', async () => {
    await uploadText(app, alice, 'notes.md', '# A\ntext').expect(201);
    const dup = await uploadText(app, alice, 'notes.md', '# B\ntext').expect(409);
    expect(dup.body.message).toBe('You already have a document with this filename');
    await uploadText(app, bob, 'notes.md', '# C\ntext').expect(201);
  });

  it.each([
    ['report.pdf', '%PDF-1.4'],
    ['noextension', 'text'],
    ['.md', 'text'],
  ])('rejects %s with 400', async (filename, content) => {
    await uploadText(app, alice, filename, content).expect(400);
  });

  it('rejects invalid UTF-8, NUL bytes and files without text with 400', async () => {
    await uploadText(app, alice, 'bin.md', Buffer.from([0xc3, 0x28])).expect(400);
    await uploadText(app, alice, 'nul.md', 'abc\u0000def').expect(400);
    await uploadText(app, alice, 'blank.md', '   \n\n  ').expect(400);
    expect(await countDocuments(app)).toBe(0);
  });

  it('rejects a bad visibility value and a missing file with 400', async () => {
    await uploadText(app, alice, 'v.md', '# T\nx', 'secret' as Visibility).expect(400);
    await request(app.getHttpServer()).post('/documents').set(bearer(alice)).field('visibility', 'public').expect(400);
  });

  it('requires a token', async () => {
    await request(app.getHttpServer()).post('/documents').attach('file', Buffer.from('x'), 'a.md').expect(401);
  });
});

describe('documents upload failures (e2e)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('answers 503 and writes nothing when the embedding service is down', async () => {
    const app = await createTestApp((b) =>
      b.overrideProvider(EMBEDDING_PROVIDER).useValue({
        dimension: 768,
        embed: async () => {
          throw new ServiceUnavailableException('Embedding service unavailable');
        },
      }),
    );
    try {
      const token = await registerAndLogin(app, 'alice@test.io');
      await uploadText(app, token, 'a.md', '# T\nbody').expect(503);
      expect(await countDocuments(app)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('rolls the document back when a chunk insert fails, and answers 500 with the request id', async () => {
    const app = await createTestApp((b) =>
      b.overrideProvider(EMBEDDING_PROVIDER).useValue({
        dimension: 767,
        embed: async (texts: string[]) => texts.map(() => Array.from({ length: 767 }, () => 0.1)),
      }),
    );
    try {
      const token = await registerAndLogin(app, 'alice@test.io');
      const res = await uploadText(app, token, 'a.md', '# T\nbody').set('x-request-id', 'upload-1').expect(500);
      expect(res.body).toEqual({ statusCode: 500, message: 'Internal error', requestId: 'upload-1' });
      expect(await countDocuments(app)).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('answers 413 for a file over UPLOAD_MAX_BYTES', async () => {
    const app = await createTestApp((b) => b.overrideProvider(uploadConfig.KEY).useValue({ maxBytes: 1000 }));
    try {
      const token = await registerAndLogin(app, 'alice@test.io');
      await uploadText(app, token, 'big.md', 'x'.repeat(5000)).expect(413);
    } finally {
      await app.close();
    }
  });
});

describe('documents list, get and delete (e2e)', () => {
  let app: INestApplication;
  let alice: string;
  let bob: string;
  let admin: string;
  let alicePrivate: string;
  let alicePublic: string;
  let bobPrivate: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
    alice = await registerAndLogin(app, 'alice@test.io');
    bob = await registerAndLogin(app, 'bob@test.io');
    admin = await createAdminAndLogin(app);
    alicePrivate = (await uploadText(app, alice, 'a-private.md', '# Alice private\nsecret').expect(201)).body.id;
    alicePublic = (await uploadText(app, alice, 'a-public.md', '# Alice public\nhello', 'public').expect(201)).body.id;
    bobPrivate = (await uploadText(app, bob, 'b-private.md', '# Bob private\nsecret').expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const titles = async (token: string): Promise<string[]> => {
    const res = await http().get('/documents').set(bearer(token)).expect(200);
    return (res.body as Array<{ title: string }>).map((d) => d.title).sort();
  };

  it('lists own plus public documents, and everything for an admin', async () => {
    expect(await titles(alice)).toEqual(['Alice private', 'Alice public']);
    expect(await titles(bob)).toEqual(['Alice public', 'Bob private']);
    expect(await titles(admin)).toEqual(['Alice private', 'Alice public', 'Bob private']);
  });

  it('answers 404 for a document the caller cannot read, and details for one they can', async () => {
    await http().get(`/documents/${bobPrivate}`).set(bearer(alice)).expect(404);
    const res = await http().get(`/documents/${alicePublic}`).set(bearer(bob)).expect(200);
    expect(res.body).toMatchObject({
      title: 'Alice public',
      visibility: 'public',
      chunks: [{ index: 0, headingPath: 'Alice public', preview: '# Alice public\n\nhello' }],
    });
  });

  it('answers 400 for an id that is not a uuid', async () => {
    await http().get('/documents/123').set(bearer(alice)).expect(400);
  });

  it('hides unreadable documents on delete (404) and forbids deleting readable ones you do not own (403)', async () => {
    await http().delete(`/documents/${alicePrivate}`).set(bearer(bob)).expect(404);
    await http().delete(`/documents/${alicePublic}`).set(bearer(bob)).expect(403);
  });

  it('lets the owner delete, and the chunks go too', async () => {
    await http().delete(`/documents/${alicePrivate}`).set(bearer(alice)).expect(204);
    await http().get(`/documents/${alicePrivate}`).set(bearer(alice)).expect(404);
    const [{ n }] = await app
      .get(DataSource)
      .query('SELECT count(*)::int AS n FROM chunks WHERE document_id = $1', [alicePrivate]);
    expect(n).toBe(0);
  });

  it('lets an admin delete any document', async () => {
    await http().delete(`/documents/${bobPrivate}`).set(bearer(admin)).expect(204);
  });
});
