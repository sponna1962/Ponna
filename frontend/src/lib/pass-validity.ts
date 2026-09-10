// Pass validity display helpers (Sept 2026 finalized requirement) — used
// by both the Home page's compact Active Pass summary and the Plans
// page's (ACCOUNT -> Plan) full Active Pass cards, so the "X days
// remaining" threshold and date format stay identical in both places.
// The actual expiry DATE always comes from the backend's computed
// `validUntil` field (see plans.service.ts) — this file only formats it
// and decides whether to show the remaining-days line, never recomputes
// the date itself.

const REMAINING_DAYS_THRESHOLD = 30;

/** Whole days between now and the given date, rounded up — so "less than
 * a day left" still reads as "1 day remaining", never "0". */
export function daysRemaining(validUntil: string | Date): number {
  const end = new Date(validUntil);
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Sept 2026 (BINDING) — "X days remaining" only inside the final 30
 * days; otherwise just the date on its own. */
export function shouldShowRemainingDays(validUntil: string | Date): boolean {
  return daysRemaining(validUntil) <= REMAINING_DAYS_THRESHOLD;
}

/** "20 Dec 2026" — the exact example format from the spec. */
export function formatValidUntil(validUntil: string | Date): string {
  return new Date(validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
