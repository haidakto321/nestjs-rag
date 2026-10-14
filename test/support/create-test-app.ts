import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';

export type Customize = (builder: TestingModuleBuilder) => TestingModuleBuilder;

// Boots the real AppModule against the Testcontainers database.
export async function createTestApp(customize?: Customize): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (customize) builder = customize(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  await app.init();
  return app;
}
