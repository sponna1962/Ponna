// Plans & Subscriptions Service — implements §7.6 (Manage plan definitions;
// view/manage individual subscriptions). Plan *codes* (FREE/PLAN_20/PLAN_50)
// and their quota structure are fixed by the requirements doc — what's
// editable here is name and price, which were explicitly left "to be
// finalized separately" (§13 Open Items).

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class PlansService {
  async listPlans() {
    return prisma.plan.findMany({ orderBy: { cycleLimit: 'asc' } });
  }

  async updatePlanPrice(planId: string, price: number) {
    return prisma.plan.update({ where: { id: planId }, data: { price } });
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
}
