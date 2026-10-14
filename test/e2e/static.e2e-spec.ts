import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/create-test-app.js';

describe('static chat page (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the chat page without a token', async () => {
    const res = await request(app.getHttpServer()).get('/ui/chat.html').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<title>nestjs-rag chat</title>');
  });

  it('serves the socket.io client script the page loads', async () => {
    await request(app.getHttpServer()).get('/socket.io/socket.io.js').expect(200);
  });
});
