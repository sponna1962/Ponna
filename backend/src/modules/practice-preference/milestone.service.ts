// Milestone Badges (finalized requirement — world-class polish, item 8).
// Derived entirely from EXISTING data (UserPerformanceSummary's OVERALL
// questionsAnswered, User.currentStreak/longestStreak, Subscription,
// MistakeReview, DailyQuizAttempt) -- no new tracking system. checkAndAward()
// is called as a side-effect wherever those numbers change (normal
// Practice answers, streak updates, a successful payment, a corrected
// mistake, a completed Daily Challenge), and returns only the
// NEWLY-crossed milestones so the frontend can celebrate just the new
// ones, not re-celebrate old badges every visit.

import { prisma } from '../../lib/prisma';
import { MilestoneType } from '@prisma/client';

export const MILESTONE_INFO: Record<MilestoneType, { label: string; emoji: string }> = {
  QUESTIONS_100: { label: '100 கேள்விகள்', emoji: '📘' },
  QUESTIONS_500: { label: '500 கேள்விகள்', emoji: '📗' },
  QUESTIONS_1000: { label: '1000 கேள்விகள்', emoji: '📚' },
  QUESTIONS_5000: { label: '5000 கேள்விகள்', emoji: '🎓' },
  STREAK_7: { label: '7-நாள் தொடர்ச்சி', emoji: '🔥' },
  STREAK_30: { label: '30-நாள் தொடர்ச்சி', emoji: '⚡' },
  STREAK_100: { label: '100-நாள் தொடர்ச்சி', emoji: '🏆' },
  FIRST_PASS: { label: 'முதல் பாஸ்', emoji: '🎟️' },
  MISTAKES_FIXED_50: { label: '50 தவறுகள் திருத்தம்', emoji: '✅' },
  DAILY_CHALLENGE_10: { label: '10 Daily Challenges', emoji: '🌟' },
};

const QUESTION_THRESHOLDS: [number, MilestoneType][] = [
  [100, 'QUESTIONS_100'],
  [500, 'QUESTIONS_500'],
  [1000, 'QUESTIONS_1000'],
  [5000, 'QUESTIONS_5000'],
];

const STREAK_THRESHOLDS: [number, MilestoneType][] = [
  [7, 'STREAK_7'],
  [30, 'STREAK_30'],
  [100, 'STREAK_100'],
];

export class MilestoneService {
  /** Checks current stats against every threshold and records any newly
   * crossed one. Safe to call as often as needed -- the unique
   * constraint on (userId, milestoneType) means a threshold already
   * recorded is never re-created, and this never touches
   * UserPerformanceSummary/streak/ranking/Subscription/MistakeReview/
   * DailyQuizAttempt, purely reads them. */
  async checkAndAward(userId: string): Promise<MilestoneType[]> {
    const [overall, user, existing, hasPaidPass, mistakesFixed, dailyChallengesCompleted] = await Promise.all([
      prisma.userPerformanceSummary.findUnique({ where: { userId_bucket: { userId, bucket: 'OVERALL' } } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currentStreak: true, longestStreak: true } }),
      prisma.studentMilestone.findMany({ where: { userId }, select: { milestoneType: true } }),
      prisma.subscription.findFirst({ where: { userId, plan: { isFree: false } }, select: { id: true } }),
      prisma.mistakeReview.count({ where: { userId, status: 'CORRECTED' } }),
      prisma.dailyQuizAttempt.count({ where: { userId, completedAt: { not: null } } }),
    ]);

    const alreadyHave = new Set(existing.map((m) => m.milestoneType));
    const toAward: MilestoneType[] = [];

    const questionsAnswered = overall?.questionsAnswered ?? 0;
    for (const [threshold, type] of QUESTION_THRESHOLDS) {
      if (questionsAnswered >= threshold && !alreadyHave.has(type)) toAward.push(type);
    }

    // Longest streak, not current -- a badge earned once (e.g. a 30-day
    // streak) should never be "lost" just because the streak later broke.
    const bestStreak = Math.max(user.currentStreak, user.longestStreak);
    for (const [threshold, type] of STREAK_THRESHOLDS) {
      if (bestStreak >= threshold && !alreadyHave.has(type)) toAward.push(type);
    }

    if (hasPaidPass && !alreadyHave.has('FIRST_PASS')) toAward.push('FIRST_PASS');
    if (mistakesFixed >= 50 && !alreadyHave.has('MISTAKES_FIXED_50')) toAward.push('MISTAKES_FIXED_50');
    if (dailyChallengesCompleted >= 10 && !alreadyHave.has('DAILY_CHALLENGE_10')) toAward.push('DAILY_CHALLENGE_10');

    if (toAward.length > 0) {
      await prisma.studentMilestone.createMany({
        data: toAward.map((milestoneType) => ({ userId, milestoneType })),
        skipDuplicates: true,
      });
    }

    return toAward;
  }

  async listMine(userId: string) {
    const rows = await prisma.studentMilestone.findMany({ where: { userId }, orderBy: { achievedAt: 'desc' } });
    return rows.map((r) => ({ type: r.milestoneType, achievedAt: r.achievedAt, ...MILESTONE_INFO[r.milestoneType] }));
  }
}

export const milestoneService = new MilestoneService();
