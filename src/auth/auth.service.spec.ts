import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../users/user.entity.js';
import type { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './auth-user.js';
import { AuthService } from './auth.service.js';
import { hashPassword, verifyPassword } from './passwords.js';

const jwt = new JwtService({ secret: 's'.repeat(32), signOptions: { expiresIn: 60 } });

function makeService(existing?: Partial<User>) {
  const users = {
    findByEmail: vi.fn(async () =>
      existing ? ({ id: 'u1', email: 'a@test.io', role: 'user', ...existing } as User) : null,
    ),
    create: vi.fn(async (input: { email: string; passwordHash: string; role?: string }) =>
      ({ id: 'u2', ...input }) as unknown as User,
    ),
  };
  return { service: new AuthService(users as unknown as UsersService, jwt), users };
}

describe('AuthService', () => {
  it('stores a bcrypt hash with role user, never the plain password', async () => {
    const { service, users } = makeService();
    await service.register('a@test.io', 'password123');
    const input = users.create.mock.calls[0][0];
    expect(input.passwordHash).not.toBe('password123');
    expect(await verifyPassword('password123', input.passwordHash)).toBe(true);
    expect(input.role).toBe('user');
  });

  it('returns a JWT with id, email and role for a correct password', async () => {
    const { service } = makeService({ passwordHash: await hashPassword('password123') });
    const { accessToken } = await service.login('a@test.io', 'password123');
    const payload = await jwt.verifyAsync<JwtPayload>(accessToken);
    expect(payload).toMatchObject({ sub: 'u1', email: 'a@test.io', role: 'user' });
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const known = makeService({ passwordHash: await hashPassword('password123') }).service;
    const unknown = makeService().service;
    const expected = new UnauthorizedException('Invalid credentials');
    await expect(known.login('a@test.io', 'wrong-pass')).rejects.toThrow(expected);
    await expect(unknown.login('ghost@test.io', 'wrong-pass')).rejects.toThrow(expected);
  });
});
