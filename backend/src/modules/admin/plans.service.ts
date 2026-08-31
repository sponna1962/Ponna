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
      select: { id: true, name: true, nameTa: true, regularPrice: true, launchPrice: true, isFree: true },
      orderBy: { name: 'asc' },
    });
  }
}
