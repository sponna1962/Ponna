// Pure helpers for the practice Question Allocation Engine (no database).
// Kept separate from allocation.service.ts so the maths — how many questions
// each subject gets, and which source (previous exam / book / original) they
// come from — is easy to unit test on its own.

export type Candidate = { id: string; sourceType: string; /** which uploaded paper/batch it came from, if known */ paperKey?: string | null };

export type RandomFn = () => number;

/** In-place Fisher–Yates shuffle; returns the same array for chaining. */
export function shuffleInPlace<T>(items: T[], rng: RandomFn = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Split `total` questions across buckets in proportion to `weights`, never
 * giving a bucket more than its `caps` (how many it can actually supply).
 * Whatever a small bucket cannot supply is re-shared among the others by the
 * same weights, so a short subject never makes the session short while other
 * subjects still have questions. Extra seats from rounding are given at random
 * in proportion to each subject's fractional share, so the
 * result always adds up to min(total, sum of caps).
 */
export function apportion(weights: number[], caps: number[], total: number, rng: RandomFn = Math.random): number[] {
  const n = weights.length;
  const result = new Array<number>(n).fill(0);
  let remaining = Math.min(Math.max(0, Math.floor(total)), caps.reduce((a, b) => a + Math.max(0, b), 0));

  while (remaining > 0) {
    const active: number[] = [];
    for (let i = 0; i < n; i++) {
      if (weights[i] > 0 && result[i] < caps[i]) active.push(i);
    }
    if (active.length === 0) break;

    const totalWeight = active.reduce((sum, i) => sum + weights[i], 0);
    const shares = active.map((i) => ({ i, ideal: (remaining * weights[i]) / totalWeight }));

    let given = 0;
    for (const s of shares) {
      const give = Math.min(Math.floor(s.ideal), caps[s.i] - result[s.i]);
      result[s.i] += give;
      given += give;
    }
    remaining -= given;
    if (remaining <= 0) break;

    // Hand out the leftover seats one by one at RANDOM, each subject's chance
    // proportional to its fractional share. (Always rounding up the biggest
    // fraction would, in a 5-question session, give the same subjects the
    // extra seat every time; this way the average over many sessions matches
    // the weights exactly.)
    // Systematic sampling: each subject's chance of the extra seat equals its
    // fractional share exactly, and exactly the right number of seats go out.
    let candidates = shares.filter((s) => result[s.i] < caps[s.i]);
    let gaveExtra = 0;
    while (remaining > 0 && candidates.length > 0) {
      shuffleInPlace(candidates, rng);
      const fractions = candidates.map((s) => s.ideal - Math.floor(s.ideal) || 1e-9);
      const seats = Math.min(remaining, candidates.length);
      const scale = seats / fractions.reduce((a, b) => a + b, 0);
      const offset = rng();
      let cumulative = 0;
      const chosen: typeof candidates = [];
      candidates.forEach((c, idx) => {
        const lower = cumulative;
        cumulative += Math.min(1, fractions[idx] * scale);
        if (Math.floor(cumulative - offset) > Math.floor(lower - offset)) chosen.push(c);
      });
      if (chosen.length === 0) chosen.push(candidates[Math.floor(rng() * candidates.length)]);
      for (const c of chosen.slice(0, remaining)) {
        result[c.i] += 1;
        remaining -= 1;
        gaveExtra += 1;
      }
      candidates = candidates.filter((c) => !chosen.includes(c) && result[c.i] < caps[c.i]);
    }
    if (given === 0 && gaveExtra === 0) break;
  }
  return result;
}

/**
 * Take `k` from candidates spread across as many different papers as possible
 * (one from each paper in turn, random order) so old question papers never
 * come back as a run from one paper. Without paper info this is a plain
 * random pick.
 */
export function pickSpreadAcrossPapers(items: Candidate[], k: number, rng: RandomFn = Math.random): Candidate[] {
  const groups = new Map<string, Candidate[]>();
  for (const c of items) {
    const key = c.paperKey ?? '';
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const queues = shuffleInPlace(Array.from(groups.values()).map((g) => shuffleInPlace(g, rng)), rng);
  const out: Candidate[] = [];
  while (out.length < k && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      if (out.length >= k) break;
      const next = q.shift();
      if (next) out.push(next);
    }
  }
  return out;
}

export type SourceMix = {
  /** Share of the slots given to the platform's own ORIGINAL questions when available. */
  originalRatio: number;
  /** Of the remaining slots, the share given to real PREVIOUS_EXAM questions when available. */
  previousExamRatio: number;
};

/**
 * Pick `k` questions at random from one subject's candidates, mixing sources:
 * ORIGINAL first (up to originalRatio), then PREVIOUS_EXAM (up to
 * previousExamRatio of what is left) and BOOK/OTHER for the rest. If a source
 * runs short the others fill in, so the count is always min(k, pool size).
 */
export function pickMixed(pool: Candidate[], k: number, mix: SourceMix, rng: RandomFn = Math.random): Candidate[] {
  const want = Math.min(Math.max(0, Math.floor(k)), pool.length);
  if (want === 0) return [];

  const original = shuffleInPlace(pool.filter((c) => c.sourceType === 'ORIGINAL'), rng);
  const previous = pool.filter((c) => c.sourceType === 'PREVIOUS_EXAM');
  const other = shuffleInPlace(pool.filter((c) => c.sourceType !== 'ORIGINAL' && c.sourceType !== 'PREVIOUS_EXAM'), rng);

  const picked: Candidate[] = [];
  const takeOriginal = Math.min(original.length, Math.round(want * mix.originalRatio));
  picked.push(...original.splice(0, takeOriginal));

  const rest = want - picked.length;
  const takePrevious = Math.min(previous.length, Math.round(rest * mix.previousExamRatio));
  const previousPicked = pickSpreadAcrossPapers(previous, takePrevious, rng);
  picked.push(...previousPicked);
  const previousLeft = previous.filter((c) => !previousPicked.includes(c));

  const takeOther = Math.min(other.length, want - picked.length);
  picked.push(...other.splice(0, takeOther));

  // A source ran short: fill the gap from whatever is left, in random order.
  const gap = want - picked.length;
  if (gap > 0) {
    const leftovers = shuffleInPlace([...previousLeft, ...other, ...original], rng);
    picked.push(...leftovers.slice(0, gap));
  }
  return picked;
}
