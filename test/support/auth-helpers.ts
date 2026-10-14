import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { hashPassword } from '../../src/auth/passwords.js';
import { UsersService } from '../../src/users/users.service.js';

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
  return res.body.accessToken as string;
}

export async function registerAndLogin(app: INestApplication, email: string, password = 'password123'): Promise<string> {
  await request(app.getHttpServer()).post('/auth/register').send({ email, password }).expect(201);
  return login(app, email, password);
}

// Admins cannot be created over HTTP (by design), so tests insert one directly.
export async function createAdminAndLogin(
  app: INestApplication,
  email = 'admin@test.io',
  password = 'admin-password-1',
): Promise<string> {
  await app.get(UsersService).create({ email, passwordHash: await hashPassword(password), role: 'admin' });
  return login(app, email, password);
}
