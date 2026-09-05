// Cut-off Marks Predictor — student-facing (finalized requirement,
// ₹999 Annual Plan value-add). Paid-only. Compares verified historical
// cut-off marks (admin-entered from official notifications) against the
// student's own tracked practice accuracy — presented explicitly as an
// approximate, practice-based indicator, never a guaranteed prediction,
// since PONNA tracks practice accuracy, not actual exam marks.

import { prisma } from '../../lib/prisma';

export class CutoffPredictorService {
  private async hasPaidAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true;
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } },
    });
    return !!activeSub;
  }

  async getPrediction(userId: string, subCategoryId: string) {
    if (!(await this.hasPaidAccess(userId))) {
      return { access: 'FREE_LOCKED' as const };
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { community: true } });
    if (!user.community) {
      return { access: 'NEEDS_COMMUNITY' as const };
    }

    const records = await prisma.cutoffRecord.findMany({
      where: { subCategoryId, community: user.community },
      orderBy: { year: 'desc' },
      take: 5,
    });

    const overall = await prisma.userPerformanceSummary.findUnique({
      where: { userId_bucket: { userId, bucket: 'OVERALL' } },
    });

    return {
      access: 'AVAILABLE' as const,
      community: user.community,
      records: records.map((r) => ({ year: r.year, cutoffMarks: r.cutoffMarks, totalMarks: r.totalMarks, sourceUrl: r.sourceUrl, verifiedAt: r.verifiedAt })),
      studentAccuracy: overall ? Math.round(overall.averagePercent) : null,
      studentQuestionsAnswered: overall?.questionsAnswered ?? 0,
    };
  }
}
