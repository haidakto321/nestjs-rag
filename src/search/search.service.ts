import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from '../ai/ai.tokens.js';
import type { EmbeddingProvider } from '../ai/embedding/embedding-provider.js';
import type { AuthUser } from '../auth/auth-user.js';
import { rrf } from './rrf.js';
import { SearchRepository } from './search.repository.js';
import {
  SEARCH_MODES,
  type ChunkMatch,
  type CompareResult,
  type SearchHit,
  type SearchMode,
  type SearchResult,
} from './search.types.js';

const HYBRID_CANDIDATES = 50;
const SNIPPET_CHARS = 300;

const elapsed = (start: number) => Math.round((performance.now() - start) * 10) / 10;

const toHits = (matches: ChunkMatch[]): SearchHit[] =>
  matches.map(({ content, ...rest }, i) => ({ ...rest, snippet: content.slice(0, SNIPPET_CHARS), rank: i + 1 }));

function required(embedding: number[] | undefined): number[] {
  if (!embedding) throw new Error('A vector search needs a query embedding');
  return embedding;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly repo: SearchRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  async search(user: AuthUser, query: string, mode: SearchMode, topK: number): Promise<SearchResult> {
    const started = performance.now();
    const embedding = mode === 'fts' ? undefined : await this.embedQuery(query);
    const matches = await this.run(user, query, embedding, mode, topK);
    return { mode, latencyMs: elapsed(started), hits: toHits(matches) };
  }

  /** Embeds once, then runs the modes one after another so their timings do not interfere. */
  async compare(user: AuthUser, query: string, topK: number): Promise<CompareResult> {
    const embedStarted = performance.now();
    const embedding = await this.embedQuery(query);
    const embedMs = elapsed(embedStarted);
    const results = {} as CompareResult['results'];
    for (const mode of SEARCH_MODES) {
      const started = performance.now();
      const matches = await this.run(user, query, embedding, mode, topK);
      results[mode] = { latencyMs: elapsed(started), hits: toHits(matches) };
    }
    return { embedMs, results };
  }

  /** Hybrid retrieval with full chunk text, for building chat context. */
  async retrieve(user: AuthUser, query: string, topK: number): Promise<ChunkMatch[]> {
    return this.run(user, query, await this.embedQuery(query), 'hybrid', topK);
  }

  private async run(
    user: AuthUser,
    query: string,
    embedding: number[] | undefined,
    mode: SearchMode,
    topK: number,
  ): Promise<ChunkMatch[]> {
    switch (mode) {
      case 'vector':
        return this.repo.vector(user, required(embedding), topK);
      case 'fts':
        return this.repo.fts(user, query, topK);
      case 'hybrid': {
        const vector = await this.repo.vector(user, required(embedding), HYBRID_CANDIDATES);
        const fts = await this.repo.fts(user, query, HYBRID_CANDIDATES);
        return rrf([vector, fts]).slice(0, topK);
      }
    }
  }

  private async embedQuery(query: string): Promise<number[]> {
    const [vector] = await this.embeddings.embed([query]);
    return vector;
  }
}
