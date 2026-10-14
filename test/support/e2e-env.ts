import { inject } from 'vitest';

// Runs in each worker before the test file is imported, so ConfigModule sees these values.
// Values already in process.env win over .env, so the developer's .env cannot leak into tests.
const db = inject('db');
process.env.DB_HOST = db.host;
process.env.DB_PORT = String(db.port);
process.env.DB_USER = db.username;
process.env.DB_PASSWORD = db.password;
process.env.DB_NAME = db.database;
process.env.JWT_SECRET = 'e2e-secret-that-is-at-least-32-characters-long';
process.env.ADMIN_EMAIL = '';
process.env.ADMIN_PASSWORD = '';
