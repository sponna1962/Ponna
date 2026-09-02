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
//
//  - Anti-abuse update (finalized requirement): "unlimited" above now means
//    unlimited WITHIN a 75-questions-per-day cap, global across every
//    covered exam (not per-exam) — a deliberate exception carved out of the
//    "no question-count quota of any kind" rule above, to deter account
//    sharing. Deducted atomically at session start via a row-locked
//    transaction (reservePaidDailyQuota below) so two devices racing to
//    start a session on the same account can't both slip through. Test
//    Accounts (isTestAccount) are exempt, same as every other quota rule.

import { PrismaClient, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Anti-abuse daily cap for PAID/covered access — global across all exams,
// not per-exam (finalized requirement).
const PAID_DAILY_LIMIT = 75;

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
  /**
   * Finds the ONE Plan in the catalog (regardless of whether this student
   * owns it) whose scope matches this selection — used to point the "Get
   * Annual Plan" button at the right plan (e.g. selecting NEET links to the
   * NEET Annual Plan, not a generic Plans list). A whole-Purpose plan
   * matches first; otherwise a Plan whose Authority scope is a superset of
   * every selected Authority (covers JEE Main-only, Advanced-only, or both,
   * all pointing at the same JEE Plan).
   */
  async findApplicablePlan(selections: AccessSelections) {
    const purposePlan = await prisma.plan.findFirst({
      where: { active: true, isFree: false, purposeId: selections.purposeId },
    });
    if (purposePlan) return purposePlan;

    if (selections.allAuthorities || selections.authorities.length === 0) return null;

    const candidates = await prisma.plan.findMany({
      where: {
        active: true,
        isFree: false,
        authorityScopes: { some: { authorityId: { in: selections.authorities.map((a) => a.authorityId) } } },
      },
      include: { authorityScopes: true },
    });
    return candidates.find((p) => selections.authorities.every((a) => p.authorityScopes.some((s) => s.authorityId === a.authorityId))) ?? null;
  }

  async getRemainingQuota(userId: string, selections: AccessSelections): Promise<number> {
    if (await this.hasUnlimitedAccess(userId, selections)) {
      return this.getRemainingPaidDailyQuota(userId);
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
      return this.reservePaidDailyQuota(userId, requestedSize);
    }

    return this.reserveFreeQuota(userId, requestedSize);
  }

  /** Read-only — how many of the 75-per-day paid cap remain right now,
   * without reserving anything. */
  private async getRemainingPaidDailyQuota(userId: string): Promise<number> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dailyPaidQuestionsUsed: true, dailyPaidQuestionsDate: true },
    });
    const today = startOfDay(new Date());
    const usedToday = user.dailyPaidQuestionsDate && isSameDay(user.dailyPaidQuestionsDate, today) ? user.dailyPaidQuestionsUsed : 0;
    return Math.max(PAID_DAILY_LIMIT - usedToday, 0);
  }

  /**
   * Atomically checks-and-reserves against the 75-per-day paid cap
   * (finalized requirement — anti account-sharing). Row-locks the User
   * row for the duration of the transaction (`FOR UPDATE`) so two
   * concurrent session-start requests for the SAME account — e.g. from two
   * different devices — can't both read the same "not yet used" count and
   * both succeed past the limit; the second one waits for the first to
   * commit, then sees the updated count.
   */
  private async reservePaidDailyQuota(userId: string, requestedSize: number): Promise<QuotaCheckResult> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ dailyPaidQuestionsUsed: number; dailyPaidQuestionsDate: Date | null }[]>`
        SELECT "dailyPaidQuestionsUsed", "dailyPaidQuestionsDate" FROM "User" WHERE id = ${userId} FOR UPDATE
      `;
      const row = rows[0];
      const today = startOfDay(new Date());
      const usedToday = row?.dailyPaidQuestionsDate && isSameDay(row.dailyPaidQuestionsDate, today) ? row.dailyPaidQuestionsUsed : 0;
      const remainingToday = PAID_DAILY_LIMIT - usedToday;

      if (requestedSize > remainingToday) {
        return {
          allowed: false,
          remaining: Math.max(remainingToday, 0),
          reason: `You've reached today's practice limit (${PAID_DAILY_LIMIT} questions/day). This resets tomorrow.`,
        };
      }

      await tx.user.update({
        where: { id: userId },
        data: { dailyPaidQuestionsDate: today, dailyPaidQuestionsUsed: usedToday + requestedSize },
      });

      return { allowed: true, remaining: remainingToday - requestedSize };
    });
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
