import type { INestApplication } from '@nestjs/common';
import { AbstractLoader, ExpressLoader } from '@nestjs/serve-static';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { CHAT_MODEL, EMBEDDING_PROVIDER } from '../../src/ai/ai.tokens.js';
import { OllamaHealthCheck } from '../../src/ai/ollama-health.check.js';
import { AppModule } from '../../src/app.module.js';
import { FakeEmbeddingProvider } from './fake-embedding.provider.js';
import { mockChatModel, textParts } from './mock-chat-model.js';

export type Customize = (builder: TestingModuleBuilder) => TestingModuleBuilder;

// Boots the real AppModule against the Testcontainers database, with Ollama replaced by fakes.
// A customize callback can override more providers; a later override of the same token wins.
export async function createTestApp(customize?: Customize): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMBEDDING_PROVIDER)
    .useValue(new FakeEmbeddingProvider())
    .overrideProvider(CHAT_MODEL)
    .useValue(mockChatModel([textParts(['Hello'])]))
    .overrideProvider(OllamaHealthCheck)
    .useValue({ onModuleInit: () => undefined })
    // ServeStaticModule picks its loader when providers are built. A TestingModule builds them in
    // compile(), before any HTTP adapter exists, so it would pick the no-op loader and serve nothing.
    .overrideProvider(AbstractLoader)
    .useClass(ExpressLoader);
  if (customize) builder = customize(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  await app.init();
  return app;
}
