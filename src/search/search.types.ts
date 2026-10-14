export const SEARCH_MODES = ['vector', 'fts', 'hybrid'] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/** One chunk found by a backend, with its full text (chat needs it for context). */
export interface ChunkMatch {
  chunkId: string;
  documentId: string;
  title: string;
  headingPath: string;
  content: string;
  score: number;
}

/** What the HTTP API returns: a snippet instead of the full text, plus the rank. */
export interface SearchHit {
  chunkId: string;
  documentId: string;
  title: string;
  headingPath: string;
  snippet: string;
  score: number;
  rank: number;
}

export interface SearchResult {
  mode: SearchMode;
  latencyMs: number;
  hits: SearchHit[];
}

export interface CompareResult {
  embedMs: number;
  results: Record<SearchMode, { latencyMs: number; hits: SearchHit[] }>;
}
