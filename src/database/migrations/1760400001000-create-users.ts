import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1760400001000 implements MigrationInterface {
  name = 'CreateUsers1760400001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE user_role AS ENUM ('user', 'admin')`);
    await queryRunner.query(`
      CREATE TABLE users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL,
        password_hash text NOT NULL,
        role          user_role NOT NULL DEFAULT 'user',
        created_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_email_key UNIQUE (email)
      )`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE user_role`);
  }
}
