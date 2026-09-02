// Anti-Abuse Service — the suspicious-usage sweep (finalized requirement).
// FLAG-ONLY: never blocks, suspends, or restricts an account by itself —
// it only sets flaggedSuspicious/flaggedReason for a Super Admin to review
// from the Students admin page. Never triggers on IP address ALONE
// (explicitly excluded per the requirement — genuine students sharing a
// network, e.g. a coaching center or a family's home Wi-Fi, must never be
// penalized for that) — IP only ever feeds the RATE/CLUSTER signal below
// (several new accounts from the same IP in a SHORT window), never a bare
// "same IP" match.
//
// Multi-signal heuristics — deliberately simple and explainable, not a
// claim of sophisticated fraud detection:
//   1. High device turnover — totalDeviceRegistrations (a lifetime
//      counter, see student-auth.service.ts's registerDevice) well beyond
//      what a normal student would ever reach just replacing a lost/
//      upgraded phone.
//   2. Sustained near-cap usage — the 75/day paid cap hit (or nearly hit)
//      for several CONSECUTIVE days in a row, tracked via nearCapStreak.
//   3. Shared device across accounts — the SAME deviceId string registered
//      to more than one distinct User (a real device, used by more than
//      one account — the family-sharing-one-phone case this system is
//      meant to catch, as distinct from the four-family-members-four-
//      phones case in the requirement's example, which this does NOT flag).
//   4. Rapid signup cluster from one IP — several accounts created from
//      the same signupIp within a short window (e.g. an hour). A short
//      window is exactly what distinguishes this from ordinary network
//      sharing: four family members signing up over days/weeks from the
//      same home IP never triggers this; five accounts created within
//      an hour from one IP does.

import { prisma } from '../../lib/prisma';


const DEVICE_CHURN_THRESHOLD = 5; // lifetime device registrations
const NEAR_CAP_FRACTION = 0.9; // 90% of the 75/day cap counts as "near"
const NEAR_CAP_STREAK_THRESHOLD = 3; // consecutive days
const PAID_DAILY_LIMIT = 75; // kept in sync with quota.service.ts's own constant
const SHARED_DEVICE_MIN_ACCOUNTS = 2; // same deviceId on >= this many distinct Users
const IP_CLUSTER_WINDOW_HOURS = 1; // "short period" for the signup-rate signal
const IP_CLUSTER_MIN_ACCOUNTS = 3; // accounts from one IP within the window

export class AntiAbuseService {
  /**
   * Run once daily (see scheduled-jobs.ts) — updates every paid user's
   * near-cap streak based on TODAY's usage (best called late in the day,
   * before the lazy calendar-day reset elsewhere would otherwise make
   * "today" look like a fresh day), then flags/clears based on all four
   * heuristics. A user already manually un-flagged by an admin can be
   * re-flagged if the pattern continues — flaggedReason always reflects
   * the CURRENT trigger(s), never accumulates history.
   */
  async runDailySweep() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: { isTestAccount: false },
      select: {
        id: true,
        dailyPaidQuestionsUsed: true,
        dailyPaidQuestionsDate: true,
        nearCapStreak: true,
        totalDeviceRegistrations: true,
        signupIp: true,
        createdAt: true,
      },
    });

    const sharedDeviceUserIds = await this.findSharedDeviceUserIds();
    const ipClusterUserIds = await this.findIpClusterUserIds();

    let flaggedCount = 0;

    for (const user of users) {
      const usedToday = user.dailyPaidQuestionsDate && sameDay(user.dailyPaidQuestionsDate, today) ? user.dailyPaidQuestionsUsed : 0;
      const wasNearCapToday = usedToday >= PAID_DAILY_LIMIT * NEAR_CAP_FRACTION;
      const newStreak = wasNearCapToday ? user.nearCapStreak + 1 : 0;

      const deviceChurnTriggered = user.totalDeviceRegistrations >= DEVICE_CHURN_THRESHOLD;
      const usageStreakTriggered = newStreak >= NEAR_CAP_STREAK_THRESHOLD;
      const sharedDeviceTriggered = sharedDeviceUserIds.has(user.id);
      const ipClusterTriggered = ipClusterUserIds.has(user.id);
      const shouldFlag = deviceChurnTriggered || usageStreakTriggered || sharedDeviceTriggered || ipClusterTriggered;

      const reasons: string[] = [];
      if (deviceChurnTriggered) reasons.push(`${user.totalDeviceRegistrations} devices registered over time`);
      if (usageStreakTriggered) reasons.push(`near daily limit for ${newStreak} consecutive days`);
      if (sharedDeviceTriggered) reasons.push('device shared with another account');
      if (ipClusterTriggered) reasons.push(`multiple accounts created from the same network within ${IP_CLUSTER_WINDOW_HOURS}h`);

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

    return { checked: users.length, flaggedCount };
  }

  /** Same device string registered to more than one distinct account. */
  private async findSharedDeviceUserIds(): Promise<Set<string>> {
    const rows = await prisma.device.groupBy({
      by: ['deviceId'],
      _count: { userId: true },
    });
    const sharedDeviceIds = rows.filter((r) => r._count.userId >= SHARED_DEVICE_MIN_ACCOUNTS).map((r) => r.deviceId);
    if (sharedDeviceIds.length === 0) return new Set();

    const devices = await prisma.device.findMany({
      where: { deviceId: { in: sharedDeviceIds } },
      select: { userId: true },
    });
    return new Set(devices.map((d) => d.userId));
  }

  /** Several accounts created from the same IP within a short window. */
  private async findIpClusterUserIds(): Promise<Set<string>> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - IP_CLUSTER_WINDOW_HOURS);

    const recentSignups = await prisma.user.findMany({
      where: { signupIp: { not: null }, createdAt: { gte: windowStart } },
      select: { id: true, signupIp: true },
    });

    const byIp = new Map<string, string[]>();
    for (const u of recentSignups) {
      if (!u.signupIp) continue;
      const list = byIp.get(u.signupIp) ?? [];
      list.push(u.id);
      byIp.set(u.signupIp, list);
    }

    const flagged = new Set<string>();
    for (const [, userIds] of byIp) {
      if (userIds.length >= IP_CLUSTER_MIN_ACCOUNTS) {
        for (const id of userIds) flagged.add(id);
      }
    }
    return flagged;
  }
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
