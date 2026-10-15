import { readFileSync } from 'node:fs';
import { validateEnv } from './env.schema.js';

const base = { JWT_SECRET: 'x'.repeat(32) };

describe('validateEnv', () => {
  it('applies defaults and coerces numbers and booleans', () => {
    const env = validateEnv({ ...base, DB_PORT: '6000', CHAT_THINK: 'false' });
    expect(env.DB_PORT).toBe(6000);
    expect(env.PORT).toBe(3001);
    expect(env.EMBEDDING_DIM).toBe(768);
    expect(validateEnv(base).DB_PORT).toBe(5434);
    expect(env.JWT_TTL_SECONDS).toBe(3600);
    expect(env.CHAT_THINK).toBe(false);
  });

  it('rejects a missing JWT_SECRET', () => {
    expect(() => validateEnv({})).toThrow(/JWT_SECRET/);
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ JWT_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('refuses to boot with the JWT_SECRET from .env.example, so a copied example is never live', () => {
    const lines = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8').split(/\r?\n/);
    const example = Object.fromEntries(
      lines.filter((line) => line.includes('=')).map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
    );
    expect(example).toHaveProperty('JWT_SECRET');
    expect(() => validateEnv(example)).toThrow(/JWT_SECRET/);
  });

  it('rejects a non-numeric port', () => {
    expect(() => validateEnv({ ...base, DB_PORT: 'abc' })).toThrow(/DB_PORT/);
  });

  it('treats empty admin values as not set', () => {
    const env = validateEnv({ ...base, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' });
    expect(env.ADMIN_EMAIL).toBeUndefined();
    expect(env.ADMIN_PASSWORD).toBeUndefined();
  });

  it('drops unrelated environment variables', () => {
    expect(validateEnv({ ...base, PATH: '/usr/bin' })).not.toHaveProperty('PATH');
  });
});
