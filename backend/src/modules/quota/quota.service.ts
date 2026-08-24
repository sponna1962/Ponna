// Quota Engine — implements §5 (Plans & Quota) and the abandoned-session rule in §4.3/§5.
//
// Rules encoded here:
//  - FREE: 5 questions/day, resets daily, no 30-day pool
//  - PLAN_20 / PLAN_50: single shared pool (600 / 1500) across Mixed+Medium+Hard,
//    valid 30 days from activation, no daily sub-limit, no carry-forward on expiry
//  - Quota is deducted in full at SESSION START, not per answered question
//  - Abandoned sessions do NOT refund quota (anti-abuse rule, §5)

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
  remaining: number; // remaining questions in the relevant window, after this session if allowed
  reason?: string;
}

export class QuotaService {
  /**
   * Checks whether a user can start a session of `requestedSize` questions,
   * and if so, atomically reserves (deducts) that quota.
   * Must be called inside the same DB transaction as QuizSession creation
   * to avoid a race between the check and the deduction.
   */
  /**
   * Read-only — how many questions the student could start a session with
   * right now, without reserving anything. Used by the simplified quiz flow
   * (mode-only selection, no size picker) to cap a session to whatever's
   * actually left, rather than requesting a fixed size and getting a hard
   * rejection when it doesn't fit.
   */
  async getRemainingQuota(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return Number.MAX_SAFE_INTEGER; // unlimited

    const subscription = await this.getActiveSubscription(userId);
    if (subscription) {
      const plan = await prisma.plan.findUnique({ where: { id: subscription.planId } });
      if (plan && plan.code !== 'FREE') {
        return Math.max((plan.cycleLimit ?? 0) - subscription.questionsUsedInCycle, 0);
      }
    }

    const freePlan = await prisma.plan.findUnique({ where: { code: 'FREE' } });
    if (!freePlan) return 0;
    const today = startOfDay(new Date());
    const sub = await prisma.subscription.findFirst({
      where: { userId, planId: freePlan.id, status: SubscriptionStatus.ACTIVE },
    });
    const usedToday = sub?.dailyUsedDate && isSameDay(sub.dailyUsedDate, today) ? sub.questionsUsedToday : 0;
    return Math.max((freePlan.dailyLimit ?? 5) - usedToday, 0);
  }

  async reserveQuota(userId: string, requestedSize: number): Promise<QuotaCheckResult> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) {
      // Finalized requirement: Test Accounts bypass ALL quota restrictions —
      // no daily/cycle limit, no plan-expiry check, nothing deducted. Return
      // exactly what was requested as "remaining" since the concept of a
      // shrinking pool doesn't apply here.
      return { allowed: true, remaining: requestedSize };
    }

    const subscription = await this.getActiveSubscription(userId);

    if (!subscription) {
      // No active paid subscription → treat as FREE plan
      return this.reserveFreeQuota(userId, requestedSize);
    }

    const plan = await prisma.plan.findUnique({ where: { id: subscription.planId } });
    if (!plan) throw new Error('Plan not found for active subscription');

    if (plan.code === 'FREE') {
      return this.reserveFreeQuota(userId, requestedSize);
    }

    // Paid plan: single 30-day pool, no daily sub-limit (§5)
    const remainingInCycle = (plan.cycleLimit ?? 0) - subscription.questionsUsedInCycle;

    if (requestedSize > remainingInCycle) {
      return {
        allowed: false,
        remaining: Math.max(remainingInCycle, 0),
        reason: `Requested ${requestedSize} questions but only ${remainingInCycle} remain in this 30-day cycle.`,
      };
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { questionsUsedInCycle: { increment: requestedSize } },
    });

    return { allowed: true, remaining: remainingInCycle - requestedSize };
  }

  private async reserveFreeQuota(userId: string, requestedSize: number): Promise<QuotaCheckResult> {
    const freePlan = await prisma.plan.findUnique({ where: { code: 'FREE' } });
    if (!freePlan) throw new Error('FREE plan not seeded');

    const today = startOfDay(new Date());

    let sub = await prisma.subscription.findFirst({
      where: { userId, planId: freePlan.id, status: SubscriptionStatus.ACTIVE },
    });

    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          userId,
          planId: freePlan.id,
          cycleEnd: farFuture(), // FREE has no 30-day cycle concept; only daily reset matters
          dailyUsedDate: today,
          questionsUsedToday: 0,
        },
      });
    }

    // Reset daily counter if it's a new day
    const usedToday =
      sub.dailyUsedDate && isSameDay(sub.dailyUsedDate, today) ? sub.questionsUsedToday : 0;

    const remainingToday = (freePlan.dailyLimit ?? 5) - usedToday;

    if (requestedSize > remainingToday) {
      return {
        allowed: false,
        remaining: Math.max(remainingToday, 0),
        reason: `Free plan allows ${freePlan.dailyLimit} questions/day. ${remainingToday} remain today.`,
      };
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        dailyUsedDate: today,
        questionsUsedToday: usedToday + requestedSize,
      },
    });

    return { allowed: true, remaining: remainingToday - requestedSize };
  }

  /**
   * Called when a session expires unresumed (§4.3 abandonment rule).
   * Deliberately does NOT touch questionsUsedInCycle / questionsUsedToday —
   * quota already spent at session start is never refunded.
   */
  async onSessionAbandoned(_sessionId: string): Promise<void> {
    // No quota reversal by design. This method exists as an explicit hook so
    // the "no refund" rule is a documented decision, not an accidental omission,
    // and so future logic (e.g. releasing reserved questions back to the pool)
    // has a clear place to live without being confused with quota logic.
  }

  private async getActiveSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        cycleEnd: { gt: new Date() },
        plan: { code: { in: ['PLAN_20', 'PLAN_50'] } },
      },
      orderBy: { cycleStart: 'desc' },
    });
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
