import { compare, hash, hashSync } from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const COST = 10;

export const hashPassword = (plain: string): Promise<string> => hash(plain, COST);

export const verifyPassword = (plain: string, hashed: string): Promise<boolean> => compare(plain, hashed);

// Hash of a random string. Login compares against it when the email is unknown,
// so "unknown email" and "wrong password" both cost one bcrypt run.
export const DUMMY_HASH = hashSync(randomUUID(), COST);
