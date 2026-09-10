// Monthly Activity Summary (Sept 2026) — "this month: X questions, Y
// minutes, Z-day streak" shown on Home and Dashboard. Makes the
// student's own effort visible to them (world-class-platform polish
// item) — purely a read/aggregate, no writes, no effect on quota,
// ranking, or streak logic itself (all of which live elsewhere).
//
// Aggregates across every place a question gets answered — Practice
// (QuizSessionQuestion), Daily/Brain Challenge (DailyQuizAnswer), Live
// Exam (MockExamQuestion) — since "this month's effort" should reflect
// all of them, not just Practice. Time-spent only sums from Practice and
// Live Exam, which are the two that track timeSpentSeconds per answer;
// Daily/Brain Challenge doesn't record per-question time, so it
// contributes to the question count but not the time total.

import { prisma } from '../../lib/prisma';

export interface MonthlyActivitySummary {
  questionsAnswered: number;
  timeSpentMinutes: number;
  currentStreak: number;
}

export class ActivitySummaryService {
  async getMonthlySummary(userId: string): Promise<MonthlyActivitySummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [practiceAgg, dailyQuizCount, mockExamAgg, user] = await Promise.all([
      prisma.quizSessionQuestion.aggregate({
        where: { answered: true, answeredAt: { gte: startOfMonth }, session: { userId } },
        _count: { _all: true },
        _sum: { timeSpentSeconds: true },
      }),
      prisma.dailyQuizAnswer.count({
        where: { answeredAt: { gte: startOfMonth }, attempt: { userId } },
      }),
      prisma.mockExamQuestion.aggregate({
        where: { answeredAt: { gte: startOfMonth }, attempt: { userId } },
        _count: { _all: true },
        _sum: { timeSpentSeconds: true },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true } }),
    ]);

    const questionsAnswered = practiceAgg._count._all + dailyQuizCount + mockExamAgg._count._all;
    const timeSpentSeconds = (practiceAgg._sum.timeSpentSeconds ?? 0) + (mockExamAgg._sum.timeSpentSeconds ?? 0);

    return {
      questionsAnswered,
      timeSpentMinutes: Math.round(timeSpentSeconds / 60),
      currentStreak: user?.currentStreak ?? 0,
    };
  }
}

export const activitySummaryService = new ActivitySummaryService();
