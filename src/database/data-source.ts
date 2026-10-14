import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.schema.js';
import { buildDataSourceOptions } from './typeorm-options.js';

// Used only by the TypeORM CLI (npm run migration:*), against the compiled dist/ output.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the real environment.
}

const env = validateEnv(process.env);

export default new DataSource(
  buildDataSourceOptions({
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  }),
);
