import request from 'supertest';
import { authConfig } from '../../src/config/app.config.js';
import { UsersService } from '../../src/users/users.service.js';
import { bearer, login, registerAndLogin } from '../support/auth-helpers.js';
import { createTestApp } from '../support/create-test-app.js';
import { resetDatabase } from '../support/reset-database.js';

// Same shape as authConfig, with the admin values the seed reads.
const seededAuth = {
  jwtSecret: process.env.JWT_SECRET as string,
  jwtTtlSeconds: 3600,
  adminEmail: 'root@test.io',
  adminPassword: 'root-password-1',
};

const appWithAdminEnv = () =>
  createTestApp((builder) => builder.overrideProvider(authConfig.KEY).useValue(seededAuth));

describe('admin seed (e2e)', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('creates the configured admin at boot, and that admin can list users', async () => {
    const app = await appWithAdminEnv();
    try {
      const token = await login(app, 'root@test.io', 'root-password-1');
      const res = await request(app.getHttpServer()).get('/users').set(bearer(token)).expect(200);
      expect(res.body).toEqual([expect.objectContaining({ email: 'root@test.io', role: 'admin' })]);
    } finally {
      await app.close();
    }
  });

  it('does not create a second admin on the next boot', async () => {
    await (await appWithAdminEnv()).close();
    const app = await appWithAdminEnv();
    try {
      expect(await app.get(UsersService).countByRole('admin')).toBe(1);
    } finally {
      await app.close();
    }
  });

  it('never promotes an existing normal user that has the admin email', async () => {
    const plain = await createTestApp();
    try {
      await registerAndLogin(plain, 'root@test.io', 'user-password-1');
    } finally {
      await plain.close();
    }
    const app = await appWithAdminEnv();
    try {
      const users = app.get(UsersService);
      expect(await users.countByRole('admin')).toBe(0);
      expect((await users.findByEmail('root@test.io'))?.role).toBe('user');
    } finally {
      await app.close();
    }
  });
});
