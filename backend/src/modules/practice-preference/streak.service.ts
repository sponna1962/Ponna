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

export async function recordStreakActivity(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastStreakDate: true },
  });

  const today = todayIstAsDate();

  if (user.lastStreakDate && daysBetween(today, user.lastStreakDate) === 0) {
    return; // already recorded today — never double-counts multiple activities on the same day
  }

  const isConsecutive = user.lastStreakDate && daysBetween(today, user.lastStreakDate) === 1;
  const newStreak = isConsecutive ? user.currentStreak + 1 : 1; // missed a day (or first-ever activity) -> restart at 1, never silently to 0

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, user.longestStreak),
      lastStreakDate: today,
    },
  });
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
