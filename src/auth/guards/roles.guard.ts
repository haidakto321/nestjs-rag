import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../users/user.entity.js';
import type { AuthUser } from '../auth-user.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

// Global guard registered after JwtAuthGuard, so request.user is already set when it runs.
// Global guards also run on gateway handlers, so @Roles must work there too.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = userOf(context);
    return !!user && required.includes(user.role);
  }
}

// HTTP: set by JwtAuthGuard. Socket: set by the gateway's handshake middleware. Any other transport
// has no user here, so a @Roles handler there is refused instead of silently skipped.
function userOf(context: ExecutionContext): AuthUser | undefined {
  switch (context.getType()) {
    case 'http':
      return context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    case 'ws':
      return context.switchToWs().getClient<{ data?: { user?: AuthUser } }>().data?.user;
    default:
      return undefined;
  }
}
