// Plans & Subscriptions Service — Plans are now fully dynamic (Phase 1/2 of
// the Annual Plan redesign): Super Admin creates/edits them from the admin
// panel, including their scope (Purpose or Authority-set) — nothing is
// hardcoded by name/code. Full create/scope-editing admin UI is Phase 3+;
// this service currently covers what the existing admin screens need.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class PlansService {
  async listPlans() {
    return prisma.plan.findMany({
      orderBy: { name: 'asc' },
      include: { purpose: true, authorityScopes: { include: { authority: true } } },
    });
  }

  async updatePlanPrice(planId: string, regularPrice: number, launchPrice?: number | null) {
    return prisma.plan.update({
      where: { id: planId },
      data: { regularPrice, launchPrice: launchPrice ?? null },
    });
  }

  async setPlanActive(planId: string, active: boolean) {
    return prisma.plan.update({ where: { id: planId }, data: { active } });
  }

  async getSubscriptionsForUser(userId: string) {
    return prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { cycleStart: 'desc' },
    });
  }

  /** Student-facing list — just what the purchase page needs. */
  async listActivePlansForStudent() {
    return prisma.plan.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        nameTa: true,
        regularPrice: true,
        launchPrice: true,
        isFree: true,
        active: true,
        sortOrder: true,
        // Included so the frontend can build a "Practice X, Y, Z" description
        // straight from real scope data — never by matching on the Plan's name.
        // Only studentVisible Authorities are listed here (Sept 15 launch
        // requirement) — a whole-Purpose Plan's scope tags on the student
        // Plans page must match what's actually available at Practice Setup,
        // not the full admin-side authority list. Authority-scoped Plans
        // (authorityScopes below) are unaffected — a Plan scoped directly to
        // a specific Authority is only ever active/shown for one anyway.
        purpose: { select: { name: true, authorities: { where: { studentVisible: true }, select: { name: true } } } },
        authorityScopes: { select: { authority: { select: { name: true, categories: { select: { name: true } } } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** This student's currently-active (unexpired) paid Subscriptions, for
   * the "My Plans" page's Active Plans section. */
  async listActiveSubscriptionsForStudent(userId: string) {
    return prisma.subscription.findMany({
      where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            nameTa: true,
            // Included so the "My Plans" bottom-sheet can show the same
            // scope tags for an Active plan as it does for a purchasable
            // one — same describeScope() logic on the frontend either way.
            // studentVisible-filtered — same reasoning as
            // listActivePlansForStudent() above.
            purpose: { select: { name: true, authorities: { where: { studentVisible: true }, select: { name: true } } } },
            authorityScopes: { select: { authority: { select: { name: true, categories: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { cycleEnd: 'asc' },
    });
  }
}
