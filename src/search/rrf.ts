/**
 * Reciprocal Rank Fusion: fused score = sum over lists of 1 / (k + rank), rank starting at 1.
 * Only ranks matter, so cosine scores and ts_rank scores (different scales) can be fused.
 * Ties keep first-seen order, so results are deterministic.
 */
export function rrf<T extends { chunkId: string; score: number }>(lists: T[][], k = 60): T[] {
  const fused = new Map<string, { hit: T; score: number }>();
  for (const list of lists) {
    list.forEach((hit, i) => {
      const entry = fused.get(hit.chunkId) ?? { hit, score: 0 };
      entry.score += 1 / (k + i + 1);
      fused.set(hit.chunkId, entry);
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score).map(({ hit, score }) => ({ ...hit, score }));
}
