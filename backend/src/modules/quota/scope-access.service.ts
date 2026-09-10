// Scope Access Service (Sept 2026, TNPSC Group IV & VAO Pass requirement) —
// the single, shared source of truth for "is this student allowed to
// select/practice this Sub-Category at all". Distinct from QuotaService,
// which only decides unlimited-vs-free QUOTA once a selection is already
// known to be legal. This service is the actual gate: called from every
// backend entry point that accepts a subCategoryId directly (Practice
// Preference save, Live Exam, Cut-off Predictor), so a restricted-plan
// student cannot reach another exam's questions even via a direct API
// request that bypasses the frontend UI entirely.
import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class ScopeRestrictedError extends Error {}

export class ScopeAccessService {
  /** True if `sub` is still within its window right now — factors in both
   * the subscription's own cycleEnd AND the plan's admin-set
   * manualExpiryOverride (exam-linked passes, e.g. Group IV & VAO Pass,
   * whose real-world validity is "until the exam", not a fixed 365 days).
   * Read-time only — no cron/status flip needed. */
  private isEffectivelyActive(sub: { status: SubscriptionStatus; cycleEnd: Date; plan: { manualExpiryOverride: Date | null } }, now: Date): boolean {
    if (sub.status !== SubscriptionStatus.ACTIVE) return false;
    if (sub.cycleEnd <= now) return false;
    if (sub.plan.manualExpiryOverride && sub.plan.manualExpiryOverride <= now) return false;
    return true;
  }

  private async getActivePaidSubs(userId: string) {
    const now = new Date();
    const subs = await prisma.subscription.findMany({
      where: { userId, status: SubscriptionStatus.ACTIVE, plan: { isFree: false } },
      include: { plan: { include: { subCategoryScopes: true } } },
    });
    return subs.filter((s) => this.isEffectivelyActive(s, now));
  }

  /**
   * Throws ScopeRestrictedError if this student's current active paid
   * subscriptions restrict them away from the given Sub-Category.
   * - Test accounts: always allowed.
   * - No paid subscription, or only the Free plan: unrestricted browsing
   *   (existing free-tier behaviour — unchanged, Free's 5/day quota still
   *   applies elsewhere via QuotaService).
   * - Any ACTIVE, non-restricted paid plan (e.g. ₹999 TNPSC Annual Pass):
   *   unrestricted — overrides any restricted plan held at the same time.
   * - Only restricted (restrictToScope=true) plan(s) active: locked to the
   *   union of those plans' subCategoryScopes.
   */
  async assertSubCategoryAllowed(userId: string, subCategoryId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return;

    const activeSubs = await this.getActivePaidSubs(userId);
    if (activeSubs.length === 0) return;

    const hasUnrestrictedPlan = activeSubs.some((s) => !s.plan.restrictToScope);
    if (hasUnrestrictedPlan) return;

    const allowedSubCategoryIds = new Set(activeSubs.flatMap((s) => s.plan.subCategoryScopes.map((sc) => sc.subCategoryId)));
    if (!allowedSubCategoryIds.has(subCategoryId)) {
      throw new ScopeRestrictedError('Your current plan does not include this exam. Upgrade to the TNPSC Annual Pass for full access.');
    }
  }

  /** True if this student's ONLY active paid coverage is a restricted plan
   * (i.e. no broader plan overrides it) — used to hide/disable Subject
   * Preference, which only makes sense across a full Authority's Categories. */
  async isRestrictedOnly(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return false;

    const activeSubs = await this.getActivePaidSubs(userId);
    if (activeSubs.length === 0) return false; // Free-only — not "restricted", just unpaid
    return activeSubs.every((s) => s.plan.restrictToScope);
  }

  /** The set of subCategoryIds a restricted-only student is locked to (for
   * the frontend to auto-lock Start Practice / Practice Preference to,
   * without a Category/Sub-Category picker). Empty if not restricted-only. */
  async getRestrictedSubCategoryIds(userId: string): Promise<string[]> {
    if (!(await this.isRestrictedOnly(userId))) return [];
    const activeSubs = await this.getActivePaidSubs(userId);
    return [...new Set(activeSubs.flatMap((s) => s.plan.subCategoryScopes.map((sc) => sc.subCategoryId)))];
  }
}

export const scopeAccessService = new ScopeAccessService();
