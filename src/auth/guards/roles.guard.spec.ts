import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth-user.js';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class Dummy {
  @Roles('admin')
  adminOnly() {}

  open() {}
}

function context(handler: () => void, user?: AuthUser, type = 'http'): ExecutionContext {
  return {
    getType: () => type,
    getHandler: () => handler,
    getClass: () => Dummy,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const guard = new RolesGuard(new Reflector());
const alice: AuthUser = { id: '1', email: 'a@test.io', role: 'user' };
const root: AuthUser = { id: '2', email: 'r@test.io', role: 'admin' };

describe('RolesGuard', () => {
  it('allows routes without @Roles', () => {
    expect(guard.canActivate(context(Dummy.prototype.open, alice))).toBe(true);
  });

  it('blocks a user on an admin route', () => {
    expect(guard.canActivate(context(Dummy.prototype.adminOnly, alice))).toBe(false);
  });

  it('allows an admin on an admin route', () => {
    expect(guard.canActivate(context(Dummy.prototype.adminOnly, root))).toBe(true);
  });

  it('blocks when there is no user at all', () => {
    expect(guard.canActivate(context(Dummy.prototype.adminOnly))).toBe(false);
  });

  it('ignores non-HTTP contexts', () => {
    expect(guard.canActivate(context(Dummy.prototype.adminOnly, undefined, 'ws'))).toBe(true);
  });
});
