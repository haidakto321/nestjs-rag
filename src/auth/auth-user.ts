import type { Role } from '../users/user.entity.js';

/** What the rest of the app knows about the caller. Built from a verified JWT, never from the body. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
