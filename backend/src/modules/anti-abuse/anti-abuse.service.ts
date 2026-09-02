// Anti-Abuse Service — the suspicious-usage sweep (finalized requirement).
// FLAG-ONLY: never blocks, suspends, or restricts an account by itself —
// it only sets flaggedSuspicious/flaggedReason for a Super Admin to review
// from the Students admin page. Never triggers on IP address alone
// (explicitly excluded per the requirement — genuine students sharing a
// network, e.g. a coaching center, must never be penalized for that).
//
// Two deliberately simple, honest heuristics — not a claim of
// sophisticated fraud detection:
//   1. High device turnover — totalDeviceRegistrations (a lifetime
//      counter, see student-auth.service.ts's registerDevice) well beyond
//      what a normal student would ever reach just replacing a lost/
//      upgraded phone.
//   2. Sustained near-cap usage — the 75/day paid cap hit (or nearly hit)
//      for several CONSECUTIVE days in a row, tracked via nearCapStreak.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEVICE_CHURN_THRESHOLD = 5; // lifetime device registrations
const NEAR_CAP_FRACTION = 0.9; // 90% of the 75/day cap counts as "near"
const NEAR_CAP_STREAK_THRESHOLD = 3; // consecutive days
const PAID_DAILY_LIMIT = 75; // kept in sync with quota.service.ts's own constant

export class AntiAbuseService {
  /**
   * Run once daily (see scheduled-jobs.ts) — updates every paid user's
   * near-cap streak based on TODAY's usage (best called late in the day,
   * before the lazy calendar-day reset elsewhere would otherwise make
   * "today" look like a fresh day), then flags/clears based on both
   * heuristics. A user already manually un-flagged by an admin can be
   * re-flagged if the pattern continues — flaggedReason always reflects
   * the CURRENT trigger, never accumulates history.
   */
  async runDailySweep() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paidUsersToday = await prisma.user.findMany({
      where: { isTestAccount: false },
      select: { id: true, dailyPaidQuestionsUsed: true, dailyPaidQuestionsDate: true, nearCapStreak: true, totalDeviceRegistrations: true, flaggedSuspicious: true },
    });

    let flaggedCount = 0;

    for (const user of paidUsersToday) {
      const usedToday = user.dailyPaidQuestionsDate && sameDay(user.dailyPaidQuestionsDate, today) ? user.dailyPaidQuestionsUsed : 0;
      const wasNearCapToday = usedToday >= PAID_DAILY_LIMIT * NEAR_CAP_FRACTION;
      const newStreak = wasNearCapToday ? user.nearCapStreak + 1 : 0;

      const deviceChurnTriggered = user.totalDeviceRegistrations >= DEVICE_CHURN_THRESHOLD;
      const usageStreakTriggered = newStreak >= NEAR_CAP_STREAK_THRESHOLD;
      const shouldFlag = deviceChurnTriggered || usageStreakTriggered;

      const reasons: string[] = [];
      if (deviceChurnTriggered) reasons.push(`${user.totalDeviceRegistrations} devices registered over time`);
      if (usageStreakTriggered) reasons.push(`near daily limit for ${newStreak} consecutive days`);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          nearCapStreak: newStreak,
          // Only ever SETS the flag here — never auto-clears one a Super
          // Admin might have deliberately left on after review; clearing
          // is a manual admin action (Students page).
          ...(shouldFlag
            ? { flaggedSuspicious: true, flaggedReason: reasons.join('; '), flaggedAt: new Date() }
            : {}),
        },
      });

      if (shouldFlag) flaggedCount++;
    }

    return { checked: paidUsersToday.length, flaggedCount };
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
