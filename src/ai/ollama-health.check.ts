import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './ai.tokens.js';
import type { EmbeddingProvider } from './embedding/embedding-provider.js';

// Lifecycle hook. Warn, never crash: auth, listing and full-text search still work without Ollama
// (springboot-rag lesson: a missing dependency at startup must not take the whole app down).
@Injectable()
export class OllamaHealthCheck implements OnModuleInit {
  private readonly logger = new Logger('Ollama');

  constructor(@Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.embeddings.embed(['ping']);
      this.logger.log(`Embedding model reachable (${this.embeddings.dimension} dims)`);
    } catch (error) {
      this.logger.warn(
        `Ollama check failed: ${(error as Error).message}. Upload, vector search and chat answer 503 until it is up.`,
      );
    }
  }
}
