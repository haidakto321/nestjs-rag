import { Exclude } from 'class-transformer';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ROLES = ['user', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// Mirrors the hand-written migration. Uniqueness of email lives in the DB (users_email_key).
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  email: string;

  // @Exclude: ClassSerializerInterceptor drops it from every HTTP response.
  @Exclude()
  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'enum', enum: [...ROLES], enumName: 'user_role', default: 'user' })
  role: Role;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
