import type { AuthUser } from '../auth/auth-user.js';
import type { DocumentEntity } from './entities/document.entity.js';

// One rule in two forms: TypeScript for single rows, SQL for queries. Keep them in sync.
export function canRead(user: AuthUser, doc: Pick<DocumentEntity, 'ownerId' | 'visibility'>): boolean {
  return doc.visibility === 'public' || doc.ownerId === user.id || user.role === 'admin';
}

export function canDelete(user: AuthUser, doc: Pick<DocumentEntity, 'ownerId'>): boolean {
  return doc.ownerId === user.id || user.role === 'admin';
}

/** SQL form of canRead. `alias` is the documents alias; params at $from and $from+1 come from readableParams. */
export function readableSql(alias: string, from: number): string {
  return `(${alias}.visibility = 'public' OR ${alias}.owner_id = $${from} OR $${from + 1}::boolean)`;
}

export function readableParams(user: AuthUser): [string, boolean] {
  return [user.id, user.role === 'admin'];
}
