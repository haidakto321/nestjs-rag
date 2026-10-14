import type { DataSourceOptions } from 'typeorm';
import { MIGRATIONS } from './migrations/index.js';

export interface DbSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// Shared by the Nest app and the TypeORM CLI, so both see the same schema history.
// Migrations are passed as classes (not globs) so Vitest can load them from TypeScript.
export function buildDataSourceOptions(db: DbSettings) {
  return {
    type: 'postgres' as const,
    ...db,
    synchronize: false,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
  } satisfies DataSourceOptions;
}
