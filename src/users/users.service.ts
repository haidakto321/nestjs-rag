import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { User, type Role } from './user.entity.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  create(input: { email: string; passwordHash: string; role?: Role }): Promise<User> {
    const user = this.users.create({
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      role: input.role ?? 'user',
    });
    return this.users.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email: normalizeEmail(email) });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findAll(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'ASC' } });
  }

  countByRole(role: Role): Promise<number> {
    return this.users.countBy({ role });
  }
}
