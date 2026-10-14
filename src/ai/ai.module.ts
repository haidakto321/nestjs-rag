import { Module } from '@nestjs/common';
import { ConfigurableModuleClass } from './ai.module-definition.js';
import { EMBEDDING_PROVIDER } from './ai.tokens.js';
import { OllamaEmbeddingProvider } from './embedding/ollama-embedding.provider.js';
import { OllamaHealthCheck } from './ollama-health.check.js';

@Module({
  providers: [{ provide: EMBEDDING_PROVIDER, useClass: OllamaEmbeddingProvider }, OllamaHealthCheck],
  exports: [EMBEDDING_PROVIDER],
})
export class AiModule extends ConfigurableModuleClass {}
