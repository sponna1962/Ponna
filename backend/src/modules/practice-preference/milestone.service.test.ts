// Unit tests for MilestoneService.checkAndAward (badge threshold
// calculations). Mocked Prisma client — no real database. These tests
// verify the CURRENT business rules as implemented in
// milestone.service.ts; they do not introduce new behaviour.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { MilestoneService } from './milestone.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-1';

/** Wires every input checkAndAward reads in one call — defaults represent
 * a brand-new student with nothing earned yet; override only what a given
 * test cares about. */
function wireInputs(overrides: {
  questionsAnswered?: number;
  currentStreak?: number;
  longestStreak?: number;
  existingMilestoneTypes?: string[];
  hasPaidPass?: boolean;
  mistakesFixed?: number;
  dailyChallengesCompleted?: number;
}) {
  prismaMock.userPerformanceSummary.findUnique.mockResolvedValue(
    overrides.questionsAnswered !== undefined ? ({ questionsAnswered: overrides.questionsAnswered } as any) : null,
  );
  prismaMock.user.findUniqueOrThrow.mockResolvedValue({
    currentStreak: overrides.currentStreak ?? 0,
    longestStreak: overrides.longestStreak ?? 0,
  } as any);
  prismaMock.studentMilestone.findMany.mockResolvedValue(
    (overrides.existingMilestoneTypes ?? []).map((milestoneType) => ({ milestoneType })) as any,
  );
  prismaMock.subscription.findFirst.mockResolvedValue(overrides.hasPaidPass ? ({ id: 'sub-1' } as any) : null);
  prismaMock.mistakeReview.count.mockResolvedValue(overrides.mistakesFixed ?? 0);
  prismaMock.dailyQuizAttempt.count.mockResolvedValue(overrides.dailyChallengesCompleted ?? 0);
  prismaMock.studentMilestone.createMany.mockResolvedValue({ count: 0 } as any);
}

describe('MilestoneService.checkAndAward', () => {
  let service: MilestoneService;

  beforeEach(() => {
    mockReset(prismaMock);
    service = new MilestoneService();
  });

  describe('threshold calculations — question count', () => {
    it('awards QUESTIONS_100 exactly at the threshold (inclusive boundary)', async () => {
      wireInputs({ questionsAnswered: 100 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toContain('QUESTIONS_100');
    });

    it('does NOT award QUESTIONS_100 one question below the threshold', async () => {
      wireInputs({ questionsAnswered: 99 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).not.toContain('QUESTIONS_100');
    });

    it('awards ALL crossed thresholds at once when a student jumps past several (e.g. a bulk history import)', async () => {
      wireInputs({ questionsAnswered: 1200 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toEqual(expect.arrayContaining(['QUESTIONS_100', 'QUESTIONS_500', 'QUESTIONS_1000']));
      expect(awarded).not.toContain('QUESTIONS_5000'); // not yet crossed
    });

    it('never re-awards an already-earned milestone', async () => {
      wireInputs({ questionsAnswered: 150, existingMilestoneTypes: ['QUESTIONS_100'] });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).not.toContain('QUESTIONS_100');
    });
  });

  describe('threshold calculations — streak', () => {
    it('awards STREAK_7 exactly at the threshold', async () => {
      wireInputs({ currentStreak: 7, longestStreak: 7 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toContain('STREAK_7');
    });

    it('does not award STREAK_7 below the threshold', async () => {
      wireInputs({ currentStreak: 6, longestStreak: 6 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).not.toContain('STREAK_7');
    });

    it('uses the BEST of current/longest streak — a broken current streak does not lose an already-earned badge basis', async () => {
      // currentStreak reset to 1 after a missed day, but longestStreak
      // still shows the earlier 30-day run.
      wireInputs({ currentStreak: 1, longestStreak: 30 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toEqual(expect.arrayContaining(['STREAK_7', 'STREAK_30']));
    });
  });

  describe('FIRST_PASS / MISTAKES_FIXED_50 / DAILY_CHALLENGE_10', () => {
    it('awards FIRST_PASS when a non-free subscription exists', async () => {
      wireInputs({ hasPaidPass: true });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toContain('FIRST_PASS');
    });

    it('does not award FIRST_PASS for a Free-only student', async () => {
      wireInputs({ hasPaidPass: false });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).not.toContain('FIRST_PASS');
    });

    it('awards MISTAKES_FIXED_50 exactly at the threshold', async () => {
      wireInputs({ mistakesFixed: 50 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toContain('MISTAKES_FIXED_50');
    });

    it('does not award MISTAKES_FIXED_50 below the threshold', async () => {
      wireInputs({ mistakesFixed: 49 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).not.toContain('MISTAKES_FIXED_50');
    });

    it('awards DAILY_CHALLENGE_10 exactly at the threshold', async () => {
      wireInputs({ dailyChallengesCompleted: 10 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toContain('DAILY_CHALLENGE_10');
    });
  });

  describe('already-awarded milestones and persistence', () => {
    it('an already-awarded milestone is excluded from the returned list even if still above threshold', async () => {
      wireInputs({ questionsAnswered: 100, currentStreak: 7, longestStreak: 7, existingMilestoneTypes: ['QUESTIONS_100', 'STREAK_7'] });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toEqual([]);
    });

    it('persists newly-crossed milestones via createMany with skipDuplicates (never a hard unique-constraint failure on a race)', async () => {
      wireInputs({ questionsAnswered: 100 });
      await service.checkAndAward(USER_ID);
      expect(prismaMock.studentMilestone.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true, data: expect.arrayContaining([{ userId: USER_ID, milestoneType: 'QUESTIONS_100' }]) }),
      );
    });

    it('does not call createMany at all when nothing new was crossed (a brand-new student with zero activity)', async () => {
      wireInputs({});
      await service.checkAndAward(USER_ID);
      expect(prismaMock.studentMilestone.createMany).not.toHaveBeenCalled();
    });
  });

  describe('backward compatibility — original 6 milestone types still behave as before the Sept 2026 extension', () => {
    it('QUESTIONS_100/500/1000 and STREAK_7/30/100 are unaffected by the 4 newly-added types (no cross-contamination)', async () => {
      wireInputs({ questionsAnswered: 1000, currentStreak: 100, longestStreak: 100, hasPaidPass: false, mistakesFixed: 0, dailyChallengesCompleted: 0 });
      const awarded = await service.checkAndAward(USER_ID);
      expect(awarded).toEqual(
        expect.arrayContaining(['QUESTIONS_100', 'QUESTIONS_500', 'QUESTIONS_1000', 'STREAK_7', 'STREAK_30', 'STREAK_100']),
      );
      expect(awarded).not.toContain('FIRST_PASS');
      expect(awarded).not.toContain('MISTAKES_FIXED_50');
      expect(awarded).not.toContain('DAILY_CHALLENGE_10');
    });
  });
});
