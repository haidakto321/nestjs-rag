/** Inject with @Inject(EMBEDDING_PROVIDER). Tests swap in a fake through the same token. */
export interface EmbeddingProvider {
  readonly dimension: number;
  embed(texts: string[]): Promise<number[][]>;
}
