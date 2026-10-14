import { InitExtensions1760400000000 } from './1760400000000-init-extensions.js';
import { CreateUsers1760400001000 } from './1760400001000-create-users.js';

// Order matters: TypeORM runs pending migrations by timestamp, and this list is the registry.
export const MIGRATIONS = [InitExtensions1760400000000, CreateUsers1760400001000];
