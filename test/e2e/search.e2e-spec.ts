import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens.js';
import { bearer, createAdminAndLogin, registerAndLogin } from '../support/auth-helpers.js';
import { createTestApp } from '../support/create-test-app.js';
import { uploadText } from '../support/document-helpers.js';
import type { FakeEmbeddingProvider } from '../support/fake-embedding.provider.js';
import { resetDatabase } from '../support/reset-database.js';

type HitsBody = { hits: Array<{ documentId: string }> };
const docIds = (body: HitsBody) => body.hits.map((h) => h.documentId);

describe('search (e2e)', () => {
  let app: INestApplication;
  let alice: string;
  let bob: string;
  let admin: string;
  let zoo: string;
  let bobDoc: string;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    alice = await registerAndLogin(app, 'alice@test.io');
    bob = await registerAndLogin(app, 'bob@test.io');
    admin = await createAdminAndLogin(app);
    zoo = (await uploadText(app, alice, 'zoo.md', '# Zoo\nThe zebracorn eats clover every morning.').expect(201)).body.id;
    await uploadText(app, alice, 'farm.md', '# Farm\nCows and sheep graze in the field.', 'public').expect(201);
    bobDoc = (await uploadText(app, bob, 'bob.md', '# Bob\nThe zebracorn password is hunter2.').expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const search = (token: string, query: Record<string, string | number>) =>
    request(app.getHttpServer()).get('/search').query(query).set(bearer(token));

  it.each(['vector', 'fts', 'hybrid'])("%s mode never returns another user's private chunks", async (mode) => {
    const res = await search(alice, { q: 'zebracorn', mode }).expect(200);
    expect(res.body.mode).toBe(mode);
    expect(docIds(res.body)).toContain(zoo);
    expect(docIds(res.body)).not.toContain(bobDoc);
  });

  it.each(['vector', 'fts', 'hybrid'])('%s mode shows bob his own chunk but not alice private one', async (mode) => {
    const res = await search(bob, { q: 'zebracorn', mode }).expect(200);
    expect(docIds(res.body)).toContain(bobDoc);
    expect(docIds(res.body)).not.toContain(zoo);
  });

  it('lets an admin find every matching chunk', async () => {
    const res = await search(admin, { q: 'zebracorn', mode: 'fts' }).expect(200);
    expect(docIds(res.body).sort()).toEqual([zoo, bobDoc].sort());
  });

  it('returns ranked hits with snippets (not full text) and a latency', async () => {
    const res = await search(alice, { q: 'zebracorn clover', mode: 'hybrid', topK: 1 }).expect(200);
    expect(res.body.latencyMs).toEqual(expect.any(Number));
    expect(res.body.hits).toHaveLength(1);
    expect(res.body.hits[0]).toMatchObject({ rank: 1, documentId: zoo, title: 'Zoo', headingPath: 'Zoo' });
    expect(res.body.hits[0].snippet.length).toBeLessThanOrEqual(300);
    expect(res.body.hits[0]).not.toHaveProperty('content');
  });

  it('compare runs all three modes with one shared embedding', async () => {
    const fake = app.get<FakeEmbeddingProvider>(EMBEDDING_PROVIDER);
    const before = fake.calls;
    const res = await request(app.getHttpServer())
      .get('/search/compare')
      .query({ q: 'zebracorn' })
      .set(bearer(alice))
      .expect(200);
    expect(fake.calls - before).toBe(1);
    expect(res.body.embedMs).toEqual(expect.any(Number));
    expect(Object.keys(res.body.results).sort()).toEqual(['fts', 'hybrid', 'vector']);
    for (const mode of ['vector', 'fts', 'hybrid']) {
      expect(res.body.results[mode].latencyMs).toEqual(expect.any(Number));
      expect(docIds(res.body.results[mode])).not.toContain(bobDoc);
    }
  });

  it.each([
    [{ q: 'x', topK: 0 }],
    [{ q: 'x', topK: 51 }],
    [{ q: 'x', mode: 'bogus' }],
    [{}],
    [{ q: '   ' }],
    [{ q: 'x'.repeat(501) }],
  ])('rejects %j with 400', async (query) => {
    await search(alice, query).expect(400);
  });

  it('requires a token', async () => {
    await request(app.getHttpServer()).get('/search').query({ q: 'x' }).expect(401);
  });

  // Keep this test last: it adds documents that the tests above do not expect.
  it('fills topK even when most nearby chunks are hidden from the caller', async () => {
    const hidden = Array.from(
      { length: 60 },
      (_, i) => `zebracorn hidden paragraph ${i} ${'filler '.repeat(195)}`,
    ).join('\n\n');
    const bobMany = (await uploadText(app, bob, 'bob-many.txt', hidden).expect(201)).body;
    expect(bobMany.chunkCount).toBe(60);
    await uploadText(app, alice, 'zoo2.md', '# Zoo two\nAnother zebracorn note.', 'public').expect(201);
    const res = await search(alice, { q: 'zebracorn hidden paragraph', mode: 'vector', topK: 3 }).expect(200);
    expect(res.body.hits).toHaveLength(3);
    expect(docIds(res.body)).not.toContain(bobMany.id);
  });
});
