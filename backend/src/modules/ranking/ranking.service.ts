// Ranking Engine — implements §8.1 (Ranking Formula).
//
// - Primary metric: average accuracy % within a bucket (OVERALL / MEDIUM / HARD)
// - Eligibility: minimum questions answered in that bucket (admin-configurable, default 50)
// - Tie-break: (1) accuracy %, (2) questions answered, (3) earliest updatedAt

import { PrismaClient, PerformanceBucket, QuizMode } from '@prisma/client';

const prisma = new PrismaClient();

export class RankingService {
  /** Call after each answer submission to keep the summary table current. */
  async updateSummaryAfterAnswer(userId: string, difficulty: 'MEDIUM' | 'HARD', wasCorrect: boolean) {
    const buckets: PerformanceBucket[] =
      difficulty === 'MEDIUM' ? [PerformanceBucket.OVERALL, PerformanceBucket.MEDIUM]
                               : [PerformanceBucket.OVERALL, PerformanceBucket.HARD];

    for (const bucket of buckets) {
      const existing = await prisma.userPerformanceSummary.findUnique({
        where: { userId_bucket: { userId, bucket } },
      });

      const questionsAnswered = (existing?.questionsAnswered ?? 0) + 1;
      const correctAnswers = (existing?.correctAnswers ?? 0) + (wasCorrect ? 1 : 0);
      const averagePercent = (correctAnswers / questionsAnswered) * 100;

      await prisma.userPerformanceSummary.upsert({
        where: { userId_bucket: { userId, bucket } },
        create: { userId, bucket, questionsAnswered, correctAnswers, averagePercent },
        update: { questionsAnswered, correctAnswers, averagePercent },
      });
    }
  }

  /**
   * Recomputes rank for every eligible user in a bucket. Run on a schedule
   * (e.g. hourly) rather than per-request — ranking doesn't need to be
   * real-time-exact, per §8.1.
   */
  async recomputeRanksForBucket(bucket: PerformanceBucket) {
    const settings = await prisma.platformSettings.findUniqueOrThrow({
      where: { id: 'singleton' },
    });
    const minQuestions = settings.rankingEligibilityMinQuestions;

    const eligible = await prisma.userPerformanceSummary.findMany({
      where: { bucket, questionsAnswered: { gte: minQuestions } },
      orderBy: [
        { averagePercent: 'desc' },   // 1. accuracy %
        { questionsAnswered: 'desc' }, // 2. tie-break: volume
        { updatedAt: 'asc' },          // 3. tie-break: earliest achievement
      ],
    });

    // Ineligible users explicitly get rank = null so the dashboard can show
    // "Not yet ranked — answer N more questions" per §8.1.
    await prisma.userPerformanceSummary.updateMany({
      where: { bucket, questionsAnswered: { lt: minQuestions } },
      data: { rank: null },
    });

    for (let i = 0; i < eligible.length; i++) {
      await prisma.userPerformanceSummary.update({
        where: { id: eligible[i].id },
        data: { rank: i + 1 },
      });
    }

    return { rankedCount: eligible.length };
  }

  async recomputeAllBuckets() {
    for (const bucket of [PerformanceBucket.OVERALL, PerformanceBucket.MEDIUM, PerformanceBucket.HARD]) {
      await this.recomputeRanksForBucket(bucket);
    }
  }

  /** Dashboard read — same shape for free and paid; caller decides whether to mask `rank`. */
  async getStudentDashboard(userId: string) {
    const rows = await prisma.userPerformanceSummary.findMany({ where: { userId } });
    return rows.reduce((acc, r) => {
      acc[r.bucket] = {
        averagePercent: r.averagePercent,
        questionsAnswered: r.questionsAnswered,
        correctAnswers: r.correctAnswers,
        rank: r.rank, // null = not yet eligible
      };
      return acc;
    }, {} as Record<string, unknown>);
  }
}
