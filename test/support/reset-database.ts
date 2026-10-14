import { DataSource } from 'typeorm';

// Empties every app table but keeps the migration history.
// Uses its own connection, so it can run before an app exists.
export async function resetDatabase(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await dataSource.initialize();
  try {
    const rows: Array<{ tablename: string }> = await dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`,
    );
    if (rows.length > 0) {
      await dataSource.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} CASCADE`);
    }
  } finally {
    await dataSource.destroy();
  }
}
