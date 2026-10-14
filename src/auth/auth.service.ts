import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './auth-user.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './passwords.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string): Promise<User> {
    return this.users.create({ email, passwordHash: await hashPassword(password), role: 'user' });
  }

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.users.findByEmail(email);
    const passwordOk = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) throw new UnauthorizedException('Invalid credentials');
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
