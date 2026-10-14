import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

let container: StartedPostgreSqlContainer | undefined;

// One throwaway Postgres for the whole e2e run. Test files read its address with inject('db').
export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('nestrag_test')
    .withUsername('rag')
    .withPassword('rag')
    .start();
  project.provide('db', {
    host: container.getHost(),
    port: container.getPort(),
    username: container.getUsername(),
    password: container.getPassword(),
    database: container.getDatabase(),
  });
}

export async function teardown(): Promise<void> {
  await container?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    db: { host: string; port: number; username: string; password: string; database: string };
  }
}
