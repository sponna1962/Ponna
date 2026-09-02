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
//    covered by any active paid Plan, they fall back to Free Preview — a
//    ONE-TIME, lifetime 5-question allowance tied to a verified phone
//    number, not a daily-resetting counter and not a new per-exam
//    allowance (finalized requirement — see the Free Preview section
//    below for the full rule).
//  - Quota is deducted (for the FREE Preview fallback only) in full at
//    SESSION START, not per answered question. Abandoned sessions do NOT
//    refund it.
//
//  - Anti-abuse update (finalized requirement): "unlimited" above now means
//    unlimited WITHIN a 75-questions-per-day cap, global across every
//    covered exam (not per-exam) — a deliberate exception carved out of the
//    "no question-count quota of any kind" rule above, to deter account
//    sharing. Deducted atomically at session start via a row-locked
//    transaction (reservePaidDailyQuota below) so two devices racing to
//    start a session on the same account can't both slip through. Test
//    Accounts (isTestAccount) are exempt, same as every other quota rule.
//
//  - Free Preview — one-time-per-verified-phone (finalized requirement,
//    the standard rule for every account from launch): 5 questions total,
//    ever, never resets by calendar day. Requires BOTH a verified phone
//    (User.phone — can only ever be set via a real Firebase Phone-OTP
//    verification, never manually typed) and an email before any
//    question is granted. Reserved atomically (reserveFreePreviewOnce
//    below), same row-locking approach as the paid daily cap. The
//    phone-uniqueness constraint is most of the actual enforcement:
//    re-verifying an already-used phone number on a different account
//    resolves back to the SAME existing User row (see
//    student-auth.service.ts's phone backfill branch) rather than
//    creating a usable second one.

import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';


// Anti-abuse daily cap for PAID/covered access — global across all exams,
// not per-exam (finalized requirement).
const PAID_DAILY_LIMIT = 75;

// One-time lifetime Free Preview cap for gated (post-launch) accounts —
// finalized requirement. Never resets by calendar day, unlike the
// grandfathered path's dailyLimit (Free Plan.dailyLimit, still 5).
const FREE_PREVIEW_LIFETIME_LIMIT = 5;

export class QuotaExceededError extends Error {
  code?: 'FREE_PREVIEW_PROFILE_INCOMPLETE' | 'FREE_PREVIEW_ALREADY_USED';
  constructor(message: string, code?: 'FREE_PREVIEW_PROFILE_INCOMPLETE' | 'FREE_PREVIEW_ALREADY_USED') {
    super(message);
    this.name = 'QuotaExceededError';
    this.code = code;
  }
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number; // Number.MAX_SAFE_INTEGER for unlimited (paid, covered) access
  reason?: string;
  // Structured codes for the gated (new-account) Free Preview path, so the
  // frontend can show the right specific guidance rather than a generic
  // "quota exceeded" message. Undefined for every other quota path
  // (grandfathered Free, paid) — those keep behaving exactly as before.
  code?: 'FREE_PREVIEW_PROFILE_INCOMPLETE' | 'FREE_PREVIEW_ALREADY_USED';
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
   * When getRemainingQuota is already 0, this returns WHY — the specific,
   * correct message/code (profile-incomplete vs already-used vs daily-
   * limit vs paid-cap) instead of a generic one-size-fits-all string.
   * Read-only, reserves nothing. Used by session.service.ts's early
   * "nothing to even try building a session for" exit, so that exit
   * doesn't show stale/wrong copy (e.g. "today" wording) for the new
   * one-time Free Preview path.
   */
  async getBlockedReason(userId: string, selections: AccessSelections): Promise<{ reason: string; code?: string }> {
    if (await this.hasUnlimitedAccess(userId, selections)) {
      return { reason: `You've reached today's practice limit (${PAID_DAILY_LIMIT} questions/day). This resets tomorrow.` };
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { freePreviewQuestionsUsed: true, email: true, phone: true },
    });
    if (!user.email || !user.phone) {
      return { reason: 'Please add your email and verify your phone number to start your Free Preview.', code: 'FREE_PREVIEW_PROFILE_INCOMPLETE' };
    }
    return {
      reason: 'You have already used your one-time Free Preview (5 questions). Get an Annual Plan to keep practising.',
      code: 'FREE_PREVIEW_ALREADY_USED',
    };
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

    return this.reserveFreePreviewOnce(userId, requestedSize);
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

  private async getRemainingFreeQuota(userId: string): Promise<number> {
    // Finalized requirement — one-time-per-phone Free Preview is the
    // standard rule for every account from launch.
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { freePreviewQuestionsUsed: true, email: true, phone: true },
    });
    if (!user.email || !user.phone) return 0; // profile incomplete — nothing usable until both are present
    return Math.max(FREE_PREVIEW_LIFETIME_LIMIT - user.freePreviewQuestionsUsed, 0);
  }

  /**
   * Atomically checks-and-reserves against the ONE-TIME 5-question
   * lifetime Free Preview cap (finalized requirement) — row-locked exactly
   * like reservePaidDailyQuota, for the same concurrent-request-safety
   * reason. Requires both email and phone present (phone is inherently
   * OTP-verified in this system — it's only ever set via a Firebase
   * phone-auth login or a Google account explicitly linking one, never
   * free text) before any question is granted; never resets by calendar
   * day.
   */
  private async reserveFreePreviewOnce(userId: string, requestedSize: number): Promise<QuotaCheckResult> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ freePreviewQuestionsUsed: number; email: string | null; phone: string | null }[]>`
        SELECT "freePreviewQuestionsUsed", "email", "phone" FROM "User" WHERE id = ${userId} FOR UPDATE
      `;
      const row = rows[0];

      if (!row?.email || !row?.phone) {
        return {
          allowed: false,
          remaining: 0,
          code: 'FREE_PREVIEW_PROFILE_INCOMPLETE' as const,
          reason: 'Please add your email and verify your phone number to start your Free Preview.',
        };
      }

      const remaining = FREE_PREVIEW_LIFETIME_LIMIT - row.freePreviewQuestionsUsed;
      if (requestedSize > remaining) {
        return {
          allowed: false,
          remaining: Math.max(remaining, 0),
          code: 'FREE_PREVIEW_ALREADY_USED' as const,
          reason: 'You have already used your one-time Free Preview (5 questions). Get an Annual Plan to keep practising.',
        };
      }

      await tx.user.update({
        where: { id: userId },
        data: { freePreviewQuestionsUsed: { increment: requestedSize } },
      });

      return { allowed: true, remaining: remaining - requestedSize };
    });
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
