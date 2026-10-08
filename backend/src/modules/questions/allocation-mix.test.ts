import { apportion, pickMixed, pickSpreadAcrossPapers, shuffleInPlace } from './allocation-mix';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('apportion', () => {
  it('follows the Group IV paper: Tamil 50%, Aptitude 12.5%, six GS subjects 6.25% each (75 questions)', () => {
    const r = apportion([8, 2, 1, 1, 1, 1, 1, 1], new Array(8).fill(1000), 75);
    expect(r.reduce((a, b) => a + b, 0)).toBe(75);
    expect(r[0]).toBeGreaterThanOrEqual(37);
    expect(r[0]).toBeLessThanOrEqual(38);
    expect(r[1]).toBeGreaterThanOrEqual(9);
    expect(r[1]).toBeLessThanOrEqual(10);
    for (const gs of r.slice(2)) {
      expect(gs).toBeGreaterThanOrEqual(4);
      expect(gs).toBeLessThanOrEqual(5);
    }
  });

  it('always adds up to the total for any size and weights', () => {
    for (let total = 0; total <= 100; total++) {
      const r = apportion([8, 2, 1, 1, 1, 1, 1, 1], new Array(8).fill(10000), total);
      expect(r.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('gives a short subject everything it has and re-shares the gap by weight', () => {
    const r = apportion([1, 1, 1, 1], [2, 1000, 1000, 1000], 20);
    expect(r[0]).toBe(2);
    expect(r.reduce((a, b) => a + b, 0)).toBe(20);
    expect(Math.max(...r.slice(1)) - Math.min(...r.slice(1))).toBeLessThanOrEqual(1);
  });

  it('never exceeds capacity and returns what exists when the total cannot be met', () => {
    const r = apportion([1, 1], [3, 4], 50);
    expect(r).toEqual([3, 4]);
  });

  it('small sessions are unbiased: over many 5-question sessions every subject gets its exact share on average', () => {
    const rng = seeded(42);
    const weights = [8, 2, 1, 1, 1, 1, 1, 1];
    const sums = new Array(8).fill(0);
    const trials = 20000;
    for (let t = 0; t < trials; t++) {
      const r = apportion(weights, new Array(8).fill(1000), 5, rng);
      expect(r.reduce((a, b) => a + b, 0)).toBe(5);
      r.forEach((v, i) => (sums[i] += v));
    }
    const ideal = [2.5, 0.625, 0.3125, 0.3125, 0.3125, 0.3125, 0.3125, 0.3125];
    sums.forEach((total, i) => expect(Math.abs(total / trials - ideal[i])).toBeLessThan(0.03));
  });

  it('gives nothing to zero or negative weights', () => {
    const r = apportion([0, 1, -2], [100, 100, 100], 10);
    expect(r).toEqual([0, 10, 0]);
  });

  it('splits equally for equal weights', () => {
    expect(apportion([1, 1], [100, 100], 11).sort()).toEqual([5, 6]);
  });
});

describe('pickMixed', () => {
  const make = (n: number, sourceType: string, prefix: string) =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, sourceType }));
  const mix = { originalRatio: 0.7, previousExamRatio: 0.6 };

  it('mixes previous-exam and book questions 60:40 when both are plentiful', () => {
    const pool = [...make(200, 'PREVIOUS_EXAM', 'p'), ...make(200, 'BOOK', 'b')];
    const r = pickMixed(pool, 50, mix, seeded(1));
    expect(r).toHaveLength(50);
    expect(r.filter((c) => c.sourceType === 'PREVIOUS_EXAM')).toHaveLength(30);
    expect(r.filter((c) => c.sourceType === 'BOOK')).toHaveLength(20);
  });

  it('fills from the other source when one runs short', () => {
    const pool = [...make(3, 'PREVIOUS_EXAM', 'p'), ...make(200, 'BOOK', 'b')];
    const r = pickMixed(pool, 50, mix, seeded(2));
    expect(r).toHaveLength(50);
    expect(r.filter((c) => c.sourceType === 'PREVIOUS_EXAM')).toHaveLength(3);
  });

  it('prefers ORIGINAL questions up to 70% when available', () => {
    const pool = [...make(10, 'ORIGINAL', 'o'), ...make(100, 'BOOK', 'b')];
    const r = pickMixed(pool, 10, mix, seeded(3));
    expect(r.filter((c) => c.sourceType === 'ORIGINAL')).toHaveLength(7);
  });

  it('returns no duplicates and never more than the pool holds', () => {
    const pool = make(5, 'BOOK', 'b');
    const r = pickMixed(pool, 50, mix, seeded(4));
    expect(r).toHaveLength(5);
    expect(new Set(r.map((c) => c.id)).size).toBe(5);
  });

  it('is random: different seeds give different picks', () => {
    const pool = make(500, 'BOOK', 'b');
    const a = pickMixed(pool, 20, mix, seeded(5)).map((c) => c.id).join();
    const b = pickMixed(pool, 20, mix, seeded(6)).map((c) => c.id).join();
    expect(a).not.toBe(b);
  });
});

describe('pickSpreadAcrossPapers', () => {
  it('takes from every paper in turn instead of running through one paper', () => {
    const paper = (key: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${key}${i}`, sourceType: 'PREVIOUS_EXAM', paperKey: key }));
    const items = [...paper('A', 100), ...paper('B', 100), ...paper('C', 100)];
    const r = pickSpreadAcrossPapers(items, 12, seeded(9));
    expect(r).toHaveLength(12);
    for (const k of ['A', 'B', 'C']) expect(r.filter((c) => c.id.startsWith(k))).toHaveLength(4);
  });

  it('still returns all it can when papers are uneven', () => {
    const items = [
      ...Array.from({ length: 2 }, (_, i) => ({ id: `A${i}`, sourceType: 'PREVIOUS_EXAM', paperKey: 'A' })),
      ...Array.from({ length: 50 }, (_, i) => ({ id: `B${i}`, sourceType: 'PREVIOUS_EXAM', paperKey: 'B' })),
    ];
    const r = pickSpreadAcrossPapers(items, 10, seeded(10));
    expect(r).toHaveLength(10);
    expect(r.filter((c) => c.id.startsWith('A'))).toHaveLength(2);
  });
});

describe('shuffleInPlace', () => {
  it('keeps all items', () => {
    const r = shuffleInPlace([1, 2, 3, 4, 5, 6], seeded(7));
    expect([...r].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
