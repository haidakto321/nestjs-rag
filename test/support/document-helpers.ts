import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Visibility } from '../../src/documents/entities/document.entity.js';
import { bearer } from './auth-helpers.js';

export function uploadText(
  app: INestApplication,
  token: string,
  filename: string,
  content: string | Buffer,
  visibility?: Visibility,
) {
  const req = request(app.getHttpServer()).post('/documents').set(bearer(token));
  if (visibility) void req.field('visibility', visibility);
  return req.attach('file', Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'), filename);
}
