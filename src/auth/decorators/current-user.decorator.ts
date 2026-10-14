import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../auth-user.js';

/** Injects the verified caller. Throws if a route forgot to require auth. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
  if (!request.user) throw new UnauthorizedException();
  return request.user;
});
