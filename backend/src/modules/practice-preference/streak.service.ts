// Daily Streak (finalized requirement — ₹999 Annual Plan value-add, item
// 3 of 3). Purely a motivational display value -- never read by
// quota.service.ts, allocation.service.ts, or ranking.service.ts. Called
// as a side-effect wherever a real activity completes (normal Practice
// session, Daily Quiz/Brain Challenge attempt).

import { prisma } from '../../lib/prisma';

const IST_OFFSET_MINUTES = 5 * 60 + 30;

/** The current instant's IST calendar date as a UTC midnight Date — used
 * purely as a comparable "day" value, same technique as Daily Quiz's own
 * IST-explicit date handling. */
function todayIstAsDate(): Date {
  const nowIst = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/** Core streak-advance logic, generalized to an explicit date instead of
 * always "now" — shared by the real-time path (today) and the Offline
 * Practice backfill path (a past date the student actually practiced
 * offline on) below. */
async function recordStreakActivityForDate(userId: string, activityDate: Date): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastStreakDate: true },
  });

  if (user.lastStreakDate && daysBetween(activityDate, user.lastStreakDate) <= 0) {
    return; // already recorded on or after this date — never moves the streak backward
  }

  const isConsecutive = user.lastStreakDate && daysBetween(activityDate, user.lastStreakDate) === 1;
  const newStreak = isConsecutive ? user.currentStreak + 1 : 1;

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, user.longestStreak),
      lastStreakDate: activityDate,
    },
  });
}

export async function recordStreakActivity(userId: string): Promise<void> {
  return recordStreakActivityForDate(userId, todayIstAsDate());
}

/** Offline Practice backfill (Sept 2026) — replays each distinct day the
 * student actually answered offline questions on (from the DEVICE's own
 * recorded timestamp, never the sync time), in chronological order, so
 * e.g. 3 offline days genuinely extend the streak by 3, not by 1.
 *
 * Safety: re-checks lastStreakDate before each date (a concurrent
 * real-time activity could interleave) and SKIPS any date at or before
 * the already-recorded lastStreakDate, rather than replaying it — an
 * out-of-order sync (e.g. the student practiced online today, then synced
 * an offline pack from 3 days ago) must never move an already-advanced
 * streak backward or corrupt it. Those stale dates are simply moot: the
 * streak already reflects a later real date.
 */
export async function backfillStreakForDates(userId: string, activityDates: Date[]): Promise<void> {
  const sorted = [...activityDates].sort((a, b) => a.getTime() - b.getTime());
  for (const date of sorted) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { lastStreakDate: true } });
    if (user.lastStreakDate && date <= user.lastStreakDate) continue;
    await recordStreakActivityForDate(userId, date);
  }
}

/** Read-only — also resets the DISPLAYED currentStreak to 0 if a day was
 * missed since the last recorded activity, without writing anything (the
 * write only happens the next time recordStreakActivity() runs, keeping
 * this function side-effect-free for a simple GET). */
export async function getStreakDisplay(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastStreakDate: true },
  });

  if (!user.lastStreakDate) return { currentStreak: 0, longestStreak: user.longestStreak };

  const gap = daysBetween(todayIstAsDate(), user.lastStreakDate);
  if (gap >= 2) return { currentStreak: 0, longestStreak: user.longestStreak }; // streak broken, display reflects it immediately even before the next activity writes it

  return { currentStreak: user.currentStreak, longestStreak: user.longestStreak };
}
