import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/create-test-app.js';

describe('app (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns app info with request id and timing headers', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body).toEqual({ name: 'nestjs-rag', docs: '/docs', chat: '/ui/chat.html' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-response-time']).toMatch(/ms$/);
  });

  it('echoes a safe client request id', async () => {
    const res = await request(app.getHttpServer()).get('/').set('x-request-id', 'trace-42');
    expect(res.headers['x-request-id']).toBe('trace-42');
  });

  it('answers an unknown route with a JSON 404', async () => {
    const res = await request(app.getHttpServer()).get('/nope').expect(404);
    expect(res.body.statusCode).toBe(404);
  });
});
