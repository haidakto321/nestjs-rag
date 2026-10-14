import type { INestApplication } from '@nestjs/common';
import { UsersService } from '../../src/users/users.service.js';
import { createTestApp } from '../support/create-test-app.js';
import { resetDatabase } from '../support/reset-database.js';

describe('UsersService against Postgres (e2e)', () => {
  let app: INestApplication;
  let users: UsersService;

  beforeAll(async () => {
    app = await createTestApp();
    users = app.get(UsersService);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores the email trimmed and lowercase, with role user by default', async () => {
    const created = await users.create({ email: '  Alice@Example.COM ', passwordHash: 'h' });
    expect(created).toMatchObject({ email: 'alice@example.com', role: 'user' });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(await users.findByEmail('ALICE@example.com')).toMatchObject({ id: created.id });
  });

  it('lets the database reject a duplicate email', async () => {
    await users.create({ email: 'a@x.io', passwordHash: 'h' });
    await expect(users.create({ email: 'A@x.io', passwordHash: 'h' })).rejects.toMatchObject({
      driverError: { code: '23505', constraint: 'users_email_key' },
    });
  });

  it('counts users by role', async () => {
    await users.create({ email: 'a@x.io', passwordHash: 'h', role: 'admin' });
    await users.create({ email: 'b@x.io', passwordHash: 'h' });
    expect(await users.countByRole('admin')).toBe(1);
    expect(await users.countByRole('user')).toBe(1);
  });
});
