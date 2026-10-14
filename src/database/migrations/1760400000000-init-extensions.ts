import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitExtensions1760400000000 implements MigrationInterface {
  name = 'InitExtensions1760400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // pgvector for embeddings. gen_random_uuid() is built into Postgres 13+, no pgcrypto needed.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
