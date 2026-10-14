import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, createAdminAndLogin, registerAndLogin } from '../support/auth-helpers.js';
import { createTestApp } from '../support/create-test-app.js';
import { resetDatabase } from '../support/reset-database.js';

describe('roles (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets an admin list users, with no password hashes', async () => {
    const admin = await createAdminAndLogin(app);
    await registerAndLogin(app, 'user@test.io');
    const res = await request(app.getHttpServer()).get('/users').set(bearer(admin)).expect(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body.map((u) => u.email).sort()).toEqual(['admin@test.io', 'user@test.io']);
    expect(body.every((u) => !('passwordHash' in u))).toBe(true);
  });

  it('returns 403 to a normal user and 401 without a token', async () => {
    const user = await registerAndLogin(app, 'user@test.io');
    await request(app.getHttpServer()).get('/users').set(bearer(user)).expect(403);
    await request(app.getHttpServer()).get('/users').expect(401);
  });
});
