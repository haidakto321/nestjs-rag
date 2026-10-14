import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bearer, login, registerAndLogin } from '../support/auth-helpers.js';
import { createTestApp } from '../support/create-test-app.js';
import { resetDatabase } from '../support/reset-database.js';

describe('auth (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user without leaking the password hash', async () => {
    const res = await http().post('/auth/register').send({ email: ' Alice@Test.io ', password: 'password123' }).expect(201);
    expect(res.body).toMatchObject({ email: 'alice@test.io', role: 'user' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('rejects a register body that tries to set a role', async () => {
    await http().post('/auth/register').send({ email: 'eve@test.io', password: 'password123', role: 'admin' }).expect(400);
  });

  it('rejects a short password and a bad email', async () => {
    await http().post('/auth/register').send({ email: 'x@test.io', password: 'short' }).expect(400);
    await http().post('/auth/register').send({ email: 'not-an-email', password: 'password123' }).expect(400);
  });

  it('returns 409 for a duplicate email in any letter case', async () => {
    await http().post('/auth/register').send({ email: 'bob@test.io', password: 'password123' }).expect(201);
    const res = await http().post('/auth/register').send({ email: 'BOB@test.io', password: 'password123' }).expect(409);
    expect(res.body.message).toBe('Email is already registered');
  });

  it('logs in and reads /auth/me with the token', async () => {
    const token = await registerAndLogin(app, 'carol@test.io');
    const me = await http().get('/auth/me').set(bearer(token)).expect(200);
    expect(me.body).toEqual({ id: expect.any(String), email: 'carol@test.io', role: 'user' });
  });

  it('gives the same 401 body for a wrong password and an unknown email', async () => {
    await registerAndLogin(app, 'dan@test.io');
    const wrong = await http().post('/auth/login').send({ email: 'dan@test.io', password: 'nope-nope' }).expect(401);
    const unknown = await http().post('/auth/login').send({ email: 'ghost@test.io', password: 'nope-nope' }).expect(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('rejects /auth/me without a token or with a forged one', async () => {
    await http().get('/auth/me').expect(401);
    await http().get('/auth/me').set(bearer('not.a.jwt')).expect(401);
  });

  it('keeps public routes open', async () => {
    await http().get('/').expect(200);
  });

  it('accepts the login email in any letter case', async () => {
    await registerAndLogin(app, 'erin@test.io');
    await login(app, 'ERIN@test.io', 'password123');
  });
});
