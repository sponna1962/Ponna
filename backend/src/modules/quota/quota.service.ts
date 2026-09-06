import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const PAID_DAILY_LIMIT = 75;
const FREE_DAILY_LIMIT = 5;

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
  remaining: number;
  reason?: string;
  code?: 'FREE_PREVIEW_PROFILE_INCOMPLETE' | 'FREE_PREVIEW_ALREADY_USED';
}

export interface AccessSelections {
  purposeId: string;
  allAuthorities: boolean;
  authorities: { authorityId: string }[];
}

export class QuotaService {
  async hasUnlimitedAccess(userId: string, selections: AccessSelections): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true;

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
    if (activeSubs.some((s) => s.plan.purposeId === selections.purposeId)) return true;
    if (selections.allAuthorities || selections.authorities.length === 0) return false;

    const coveredAuthorityIds = new Set(activeSubs.flatMap((s) => s.plan.authorityScopes.map((a) => a.authorityId)));
    return selections.authorities.every((a) => coveredAuthorityIds.has(a.authorityId));
  }

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
    if (await this.hasUnlimitedAccess(userId, selections)) return this.getRemainingPaidDailyQuota(userId);
    return this.getRemainingFreeQuota(userId);
  }

  async getBlockedReason(userId: string, selections: AccessSelections): Promise<{ reason: string; code?: string }> {
    if (await this.hasUnlimitedAccess(userId, selections)) {
      return { reason: `You've reached today's practice limit (${PAID_DAILY_LIMIT} questions/day). This resets tomorrow.` };
    }
    return {
      reason: `Today's free practice limit of ${FREE_DAILY_LIMIT} questions has been used. Get an Annual Plan to keep practising.`,
      code: 'FREE_PREVIEW_ALREADY_USED',
    };
  }

  async reserveQuota(userId: string, requestedSize: number, selections: AccessSelections): Promise<QuotaCheckResult> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return { allowed: true, remaining: requestedSize };
    if (await this.hasUnlimitedAccess(userId, selections)) return this.reservePaidDailyQuota(userId, requestedSize);
    return this.reserveFreeDailyQuota(userId, requestedSize);
  }

  private async getRemainingPaidDailyQuota(userId: string): Promise<number> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { dailyPaidQuestionsUsed: true, dailyPaidQuestionsDate: true },
    });
    const today = startOfDay(new Date());
    const usedToday = user.dailyPaidQuestionsDate && isSameDay(user.dailyPaidQuestionsDate, today) ? user.dailyPaidQuestionsUsed : 0;
    return Math.max(PAID_DAILY_LIMIT - usedToday, 0);
  }

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
        return { allowed: false, remaining: Math.max(remainingToday, 0), reason: `You've reached today's practice limit (${PAID_DAILY_LIMIT} questions/day). This resets tomorrow.` };
      }
      await tx.user.update({ where: { id: userId }, data: { dailyPaidQuestionsDate: today, dailyPaidQuestionsUsed: usedToday + requestedSize } });
      return { allowed: true, remaining: remainingToday - requestedSize };
    });
  }

  private async getFreeUsedToday(userId: string): Promise<number> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { freePreviewQuestionsUsed: true },
    });
    const packed = user.freePreviewQuestionsUsed;
    const day = Math.floor(packed / 10);
    const todayDay = calendarDayNumber(new Date());
    return day === todayDay ? packed % 10 : 0;
  }

  private async getRemainingFreeQuota(userId: string): Promise<number> {
    return Math.max(FREE_DAILY_LIMIT - await this.getFreeUsedToday(userId), 0);
  }

  private async reserveFreeDailyQuota(userId: string, requestedSize: number): Promise<QuotaCheckResult> {
    return prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ freePreviewQuestionsUsed: number }[]>`
        SELECT "freePreviewQuestionsUsed" FROM "User" WHERE id = ${userId} FOR UPDATE
      `;
      const current = rows[0]?.freePreviewQuestionsUsed ?? 0;
      const todayDay = calendarDayNumber(new Date());
      const storedDay = Math.floor(current / 10);
      const usedToday = storedDay === todayDay ? current % 10 : 0;
      const remaining = FREE_DAILY_LIMIT - usedToday;

      if (requestedSize > remaining) {
        return {
          allowed: false,
          remaining: Math.max(remaining, 0),
          code: 'FREE_PREVIEW_ALREADY_USED' as const,
          reason: `Today's free practice limit of ${FREE_DAILY_LIMIT} questions has been used. Get an Annual Plan to keep practising.`,
        };
      }

      await tx.user.update({
        where: { id: userId },
        data: { freePreviewQuestionsUsed: todayDay * 10 + usedToday + requestedSize },
      });

      return { allowed: true, remaining: remaining - requestedSize };
    });
  }

  async onSessionAbandoned(_sessionId: string): Promise<void> {}
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function calendarDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
