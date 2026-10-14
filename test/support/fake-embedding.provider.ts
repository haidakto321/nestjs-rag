import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from '../../src/ai/embedding/embedding-provider.js';

/** Deterministic vectors from hashed words: texts that share words land close together. */
export function fakeVector(text: string, dim = 768): number[] {
  const vector = Array.from({ length: dim }, () => 0);
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const word of words) {
    const hash = createHash('sha256').update(word).digest();
    vector[hash.readUInt16BE(0) % dim] += 1;
    vector[hash.readUInt16BE(2) % dim] += 0.5;
  }
  if (words.length === 0) vector[0] = 1; // a zero vector has no cosine distance
  const norm = Math.hypot(...vector);
  return vector.map((x) => x / norm);
}

export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly dimension = 768;
  calls = 0;

  async embed(texts: string[]): Promise<number[][]> {
    this.calls += 1;
    return texts.map((text) => fakeVector(text, this.dimension));
  }
}
