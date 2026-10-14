import type { AuthUser } from '../auth/auth-user.js';
import { canDelete, canRead, readableParams, readableSql } from './visibility.js';

const alice: AuthUser = { id: 'a', email: 'a@test.io', role: 'user' };
const bob: AuthUser = { id: 'b', email: 'b@test.io', role: 'user' };
const root: AuthUser = { id: 'r', email: 'r@test.io', role: 'admin' };
const alicePrivate = { ownerId: 'a', visibility: 'private' as const };
const alicePublic = { ownerId: 'a', visibility: 'public' as const };

describe('visibility', () => {
  it('lets anyone read public documents and owners read their private ones', () => {
    expect(canRead(bob, alicePublic)).toBe(true);
    expect(canRead(alice, alicePrivate)).toBe(true);
    expect(canRead(bob, alicePrivate)).toBe(false);
  });

  it('lets an admin read everything', () => {
    expect(canRead(root, alicePrivate)).toBe(true);
  });

  it('allows delete only to the owner or an admin, even for public documents', () => {
    expect(canDelete(bob, alicePublic)).toBe(false);
    expect(canDelete(alice, alicePublic)).toBe(true);
    expect(canDelete(root, alicePrivate)).toBe(true);
  });

  it('expresses the same read rule in SQL with numbered placeholders', () => {
    expect(readableSql('d', 2)).toBe(`(d.visibility = 'public' OR d.owner_id = $2 OR $3::boolean)`);
    expect(readableParams(alice)).toEqual(['a', false]);
    expect(readableParams(root)).toEqual(['r', true]);
  });
});
