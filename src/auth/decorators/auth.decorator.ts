import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Role } from '../../users/user.entity.js';
import { Roles } from './roles.decorator.js';

/** One decorator for "needs these roles", plus the matching Swagger hints. */
export function Auth(...roles: Role[]) {
  return applyDecorators(
    Roles(...roles),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Missing or invalid token' }),
    ApiForbiddenResponse({ description: `Needs role: ${roles.join(' or ')}` }),
  );
}
