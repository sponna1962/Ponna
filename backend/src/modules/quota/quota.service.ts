// Access & Quota Engine — Phase 2 of the Annual Plan redesign.
//
// Rules encoded here (finalized requirements):
//  - Paid Annual Plans grant UNLIMITED practice (no question-count quota of
//    any kind — no daily/weekly/monthly/annual cap) for their full 12-month
//    validity, but ONLY within their SCOPE:
//      - a whole-Purpose Plan (e.g. Competitive / Employment) covers every
//        Authority under that Purpose, including ones added later
//      - an Authority-scoped Plan (NEET, JEE [Main+Advanced], CLAT, TNTET...)
//        covers ONLY the specific Authority(ies) linked to it — never the
//        whole Purpose, even if that Purpose happens to be Higher
//        Education/Entrance (rule: a specific Entrance Plan must never
//        accidentally grant access to the entire Purpose)
//  - A student may hold several active paid Subscriptions simultaneously;
//    each is checked independently — NEET being covered has no bearing on
//    whether JEE is covered.
//  - Whenever the student's current Practice Preference selection is NOT
//    covered by any active paid Plan, they fall back to the existing FREE
//    plan: a single shared 5-questions/day counter (unchanged from before
//    this redesign) — not a new per-exam free allowance.
//  - Quota is deducted (for the FREE fallback only) in full at SESSION
//    START, not per answered question. Abandoned sessions do NOT refund it.

import { PrismaClient, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number; // Number.MAX_SAFE_INTEGER for unlimited (paid, covered) access
  reason?: string;
}

/** The shape of a saved Practice Preference's `selections` JSON that access
 * checks need — matches practice-preference.service.ts's Selections type. */
export interface AccessSelections {
  purposeId: string;
  allAuthorities: boolean;
  authorities: { authorityId: string }[];
}

export class QuotaService {
  /**
   * Does the student currently hold an active paid Plan whose scope covers
   * this ENTIRE selection? A whole-Purpose Plan covers everything under
   * that Purpose. Otherwise, EVERY selected Authority must individually be
   * covered by SOME active Plan's Authority scope (different Plans may
   * jointly cover different Authorities — e.g. this never happens in
   * practice since Higher Education/Entrance only ever selects one
   * Authority or the JEE pair, but the check is written generally).
   */
  async hasUnlimitedAccess(userId: string, selections: AccessSelections): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true; // Test Accounts bypass everything, unchanged from before

    const activeSubs = await prisma.subscription.findMany({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        cycleEnd: { gt: new Date() },
        plan: { isFree: false },
      },
      include: { plan: { include: { authorityScopes: true } } },
    });
    if (activeSubs.length === 0) return false;

    // Whole-Purpose coverage (e.g. Competitive / Employment Plan).
    if (activeSubs.some((s) => s.plan.purposeId === selections.purposeId)) return true;

    // Authority-scoped coverage — every authority actually being practiced
    // must be covered. `allAuthorities` only ever appears on a Purpose that
    // allows it (Competitive/Employment), which is already handled by the
    // whole-Purpose check above; if we get here with allAuthorities true
    // and no whole-Purpose Plan, there's nothing further to check against.
    if (selections.allAuthorities || selections.authorities.length === 0) return false;

    const coveredAuthorityIds = new Set(activeSubs.flatMap((s) => s.plan.authorityScopes.map((a) => a.authorityId)));
    return selections.authorities.every((a) => coveredAuthorityIds.has(a.authorityId));
  }

  /**
   * Read-only — how many questions the student could start a session with
   * right now, without reserving anything. Number.MAX_SAFE_INTEGER when the
   * selection is covered by an active paid Plan (genuinely unlimited, not
   * just "a big number" — never shown to the student as a number, Phase 3).
   */
  async getRemainingQuota(userId: string, selections: AccessSelections): Promise<number> {
    if (await this.hasUnlimitedAccess(userId, selections)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return this.getRemainingFreeQuota(userId);
  }

  /**
   * Checks whether a user can start a session of `requestedSize` questions
   * for this selection, and if so, reserves it. A covered (paid) selection
   * always succeeds and reserves nothing (there is nothing to track — no
   * quota exists for paid access). An uncovered selection falls back to the
   * FREE plan's 5/day counter, exactly as before this redesign.
   */
  async reserveQuota(userId: string, requestedSize: number, selections: AccessSelections): Promise<QuotaCheckResult> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) {
      return { allowed: true, remaining: requestedSize };
    }

    if (await this.hasUnlimitedAccess(userId, selections)) {
      return { allowed: true, remaining: Number.MAX_SAFE_INTEGER };
    }

    return this.reserveFreeQuota(userId, requestedSize);
  }

  private async getFreePlan() {
    const freePlan = await prisma.plan.findFirst({ where: { isFree: true } });
    if (!freePlan) throw new Error('No Plan has isFree=true — the Free fallback plan must be seeded.');
    return freePlan;
  }

  private async getRemainingFreeQuota(userId: string): Promise<number> {
    const freePlan = await this.getFreePlan();
    const today = startOfDay(new Date());
    const sub = await prisma.subscription.findFirst({
      where: { userId, planId: freePlan.id, status: SubscriptionStatus.ACTIVE },
    });
    const usedToday = sub?.dailyUsedDate && isSameDay(sub.dailyUsedDate, today) ? sub.questionsUsedToday : 0;
    return Math.max((freePlan.dailyLimit ?? 5) - usedToday, 0);
  }

  private async reserveFreeQuota(userId: string, requestedSize: number): Promise<QuotaCheckResult> {
    const freePlan = await this.getFreePlan();
    const today = startOfDay(new Date());

    let sub = await prisma.subscription.findFirst({
      where: { userId, planId: freePlan.id, status: SubscriptionStatus.ACTIVE },
    });

    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          userId,
          planId: freePlan.id,
          cycleEnd: farFuture(), // FREE has no cycle concept; only the daily reset matters
          dailyUsedDate: today,
          questionsUsedToday: 0,
        },
      });
    }

    const usedToday = sub.dailyUsedDate && isSameDay(sub.dailyUsedDate, today) ? sub.questionsUsedToday : 0;
    const remainingToday = (freePlan.dailyLimit ?? 5) - usedToday;

    if (requestedSize > remainingToday) {
      return {
        allowed: false,
        remaining: Math.max(remainingToday, 0),
        reason: `Free practice allows ${freePlan.dailyLimit} questions/day for exams without an active Annual Plan. ${remainingToday} remain today.`,
      };
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { dailyUsedDate: today, questionsUsedToday: usedToday + requestedSize },
    });

    return { allowed: true, remaining: remainingToday - requestedSize };
  }

  /**
   * Called when a session expires unresumed. Deliberately does NOT touch
   * questionsUsedToday — quota already spent (Free plan only; paid access
   * has nothing to reverse) is never refunded, same rule as before.
   */
  async onSessionAbandoned(_sessionId: string): Promise<void> {
    // No-op by design — documents the rule; see docstring above.
  }
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
function farFuture(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 100);
  return d;
}
