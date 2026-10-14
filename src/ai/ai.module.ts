import { Module } from '@nestjs/common';
import { ConfigurableModuleClass } from './ai.module-definition.js';
import { CHAT_MODEL, EMBEDDING_PROVIDER } from './ai.tokens.js';
import { chatModelProvider } from './chat-model.provider.js';
import { OllamaEmbeddingProvider } from './embedding/ollama-embedding.provider.js';
import { OllamaHealthCheck } from './ollama-health.check.js';

@Module({
  providers: [
    { provide: EMBEDDING_PROVIDER, useClass: OllamaEmbeddingProvider },
    chatModelProvider,
    OllamaHealthCheck,
  ],
  exports: [EMBEDDING_PROVIDER, CHAT_MODEL],
})
export class AiModule extends ConfigurableModuleClass {}
