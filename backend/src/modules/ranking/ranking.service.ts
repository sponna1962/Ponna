// Ranking Engine — implements §8.1 (Ranking Formula) plus the two-check Rank
// gate from the profile-completion requirement:
//   Rank is shown only if BOTH (1) the student's plan is eligible (paid) AND
//   (2) their profile (district, city/town/village, preparing-for) is
//   complete. Free practice and basic score viewing (avg %, answered,
//   correct) never require either check.

import { PrismaClient, PerformanceBucket, QuizMode } from '@prisma/client';
import { isProfileComplete } from '../profile/profile.service';

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
      where: {
        bucket,
        questionsAnswered: { gte: minQuestions },
        user: { isTestAccount: false }, // Test Accounts never appear in real student rankings (finalized requirement)
      },
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

    // Test Accounts never get a rank number, regardless of how many
    // questions they've answered — excluded from real student rankings.
    const testAccountUserIds = (await prisma.user.findMany({ where: { isTestAccount: true }, select: { id: true } })).map((u) => u.id);
    if (testAccountUserIds.length > 0) {
      await prisma.userPerformanceSummary.updateMany({
        where: { bucket, userId: { in: testAccountUserIds } },
        data: { rank: null },
      });
    }

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

  /**
   * Dashboard read. Rank is only populated in the response when BOTH gates
   * pass (plan eligible + profile complete) — otherwise it's null, and the
   * two flags tell the frontend exactly which CTA to show ("Upgrade your
   * plan" vs "Complete your profile") rather than a generic "locked" state.
   */
  async getStudentDashboard(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        // Not `take: 1` — a student may hold several concurrent active
        // Subscriptions (finalized requirement); rank unlock only needs
        // ANY of them to be a real paid plan, not specifically the most
        // recent one.
        subscriptions: { where: { status: 'ACTIVE', cycleEnd: { gt: new Date() } }, include: { plan: true } },
      },
    });

    const planEligible = user.subscriptions.some((s) => !s.plan.isFree);
    const profileComplete = isProfileComplete(user);
    const rankUnlocked = planEligible && profileComplete;

    const rows = await prisma.userPerformanceSummary.findMany({ where: { userId } });
    const buckets = rows.reduce((acc, r) => {
      acc[r.bucket] = {
        averagePercent: r.averagePercent,
        questionsAnswered: r.questionsAnswered,
        correctAnswers: r.correctAnswers,
        // rank stays null even for eligible users until they clear the
        // §8.1 minimum-questions threshold — that's a separate, orthogonal
        // gate from planEligible/profileComplete and needs no flag of its
        // own (the frontend already shows "not yet eligible" for null rank
        // when rankUnlocked is true).
        rank: rankUnlocked ? r.rank : null,
      };
      return acc;
    }, {} as Record<string, unknown>);

    return { buckets, planEligible, profileComplete, rankUnlocked };
  }
}
