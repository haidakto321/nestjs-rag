import { rrf } from './rrf.js';

const hit = (chunkId: string, score = 0) => ({ chunkId, score });

describe('rrf', () => {
  it('ranks an item found by both lists above items found by one', () => {
    expect(rrf([[hit('a'), hit('b')], [hit('c'), hit('b')]]).map((h) => h.chunkId)).toEqual(['b', 'a', 'c']);
  });

  it('scores 1 / (k + rank) with rank starting at 1', () => {
    const [first, second] = rrf([[hit('a'), hit('b')]]);
    expect(first.score).toBeCloseTo(1 / 61);
    expect(second.score).toBeCloseTo(1 / 62);
  });

  it('lets k change the curve', () => {
    expect(rrf([[hit('a')]], 0)[0].score).toBe(1);
  });

  it('ignores original scores, which live on different scales', () => {
    expect(rrf([[hit('a', 0.99)], [hit('b', 42)]]).map((h) => h.score)).toEqual([1 / 61, 1 / 61]);
  });

  it('returns an empty list for empty input', () => {
    expect(rrf([[], []])).toEqual([]);
  });
});
