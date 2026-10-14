import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AI_MODULE_OPTIONS, type AiModuleOptions } from '../ai.module-definition.js';
import type { EmbeddingProvider } from './embedding-provider.js';

const BATCH_SIZE = 32;
const TIMEOUT_MS = 60_000;

// Plain fetch to Ollama's /api/embed: no SDK, so the HTTP contract stays visible.
@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly dimension: number;
  private readonly logger = new Logger(OllamaEmbeddingProvider.name);

  constructor(@Inject(AI_MODULE_OPTIONS) private readonly options: AiModuleOptions) {
    this.dimension = options.embeddingDim;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      vectors.push(...(await this.embedBatch(texts.slice(i, i + BATCH_SIZE))));
    }
    return vectors;
  }

  private async embedBatch(input: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(new URL('/api/embed', this.options.ollamaBaseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.options.embeddingModel, input }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.error(`Ollama unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Embedding service unavailable');
    }
    if (!response.ok) {
      this.logger.error(`Ollama answered ${response.status}: ${await response.text()}`);
      throw new ServiceUnavailableException('Embedding service unavailable');
    }
    const { embeddings = [] } = (await response.json()) as { embeddings?: number[][] };
    if (embeddings.length !== input.length) {
      this.logger.error(`Asked for ${input.length} embeddings, got ${embeddings.length}`);
      throw new ServiceUnavailableException('Embedding service unavailable');
    }
    const wrong = embeddings.find((vector) => vector.length !== this.dimension);
    if (wrong) {
      // A config mistake, not a secret: say it plainly.
      throw new ServiceUnavailableException(
        `Embedding model returned ${wrong.length} dimensions but EMBEDDING_DIM is ${this.dimension}`,
      );
    }
    return embeddings;
  }
}
