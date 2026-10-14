// Mind Gym (Oct 2026) -- small memory / speed / reasoning practices that run
// entirely in the browser: random numbers and fixed word lists, no server, no
// AI, no cost. A student's own best result is kept in THIS browser only and is
// never compared with anyone else.

export const MG_PAPER = '#FBF6E9';
export const MG_INK = '#0F2F33';
export const MG_TEAL = '#1c6b6b';
export const MG_GOLD = '#C98A12';
export const MG_GOOD = '#237a3b';
export const MG_BAD = '#b3392b';

export function readBest(key: string): number {
  try {
    const v = Number(window.localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(key: string, value: number) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* storage unavailable */ }
}

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The right answer plus 3 different wrong ones, shuffled. Wrong answers are
 * supplied by the caller (nearby values); duplicates of the answer are dropped
 * and, if needed, extra neighbours are added so there are always 4 options. */
export function buildOptions(answer: string, wrong: string[], fallback: () => string): { options: string[]; answerIndex: number } {
  const set = new Set<string>([answer]);
  for (const w of wrong) if (set.size < 4) set.add(w);
  let guard = 0;
  while (set.size < 4 && guard++ < 50) set.add(fallback());
  const options = shuffle(Array.from(set));
  return { options, answerIndex: options.indexOf(answer) };
}
