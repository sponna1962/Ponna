// Unit tests for AllocationService.buildSessionQuestionIds (Question
// Allocation Engine). Mocked Prisma client — no real database. Each
// test wires prisma.question.findMany with sequential
// mockResolvedValueOnce calls matching the EXACT call order the
// implementation makes (Current Affairs -> Preferred -> General ->
// broadened-Difficulty fallback) — verified against the real
// allocation.service.ts source, not assumed. These tests verify the
// CURRENT business rules as implemented; they do not introduce new
// behaviour.
//
// NOTE on "Free/Paid access separation": this file does NOT itself
// enforce quota/paid-vs-free access — that is entirely
// quota.service.ts's responsibility (already covered in the previous
// test phase, quota.service.test.ts). Documented here rather than
// force-testing behaviour that doesn't exist in this file.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { AllocationService } from './allocation.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-1';
const TAXONOMY_FILTER = { authorityId: 'tnpsc' }; // stand-in for a real Prisma.QuestionWhereInput fragment

const DEFAULT_SETTINGS = {
  caRecencyWindowDays: 90,
  caMaxFor5Q: 1,
  caMaxFor20Q: 3,
  caMaxFor50Q: 5,
  subjectTopicPreferenceWeightPercent: 75,
};

function questionRow(id: string) {
  return { id };
}

describe('AllocationService.buildSessionQuestionIds', () => {
  let service: AllocationService;

  beforeEach(() => {
    mockReset(prismaMock);
    service = new AllocationService();
    prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue(DEFAULT_SETTINGS as any);
  });

  describe('No-repeat question selection', () => {
    it('every question query includes history: { none: { userId } } — never re-serves an answered question', async () => {
      // No preference, CA cap 0 (sessionSize <=5 but settings.caMaxFor5Q>0
      // above -> use size 100 to force CA cap via the >50 branch = 0-ish;
      // simplest: settings caMaxFor5Q=1, size 5 -> CA step runs once, then
      // unseen step runs).
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA step: none available
        .mockResolvedValueOnce([questionRow('q1'), questionRow('q2')]) // unseen step
        .mockResolvedValueOnce([]); // Step 3 broadened (still short of 5)

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      for (const call of prismaMock.question.findMany.mock.calls) {
        const where = call[0]?.where as any;
        expect(where.history).toEqual({ none: { userId: USER_ID } });
      }
    });

    it('returns fewer than sessionSize (never repeats) when the unseen pool is exhausted, even after the broadened-Difficulty fallback', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1')]) // unseen (Difficulty-matched) — only 1 found
        .mockResolvedValueOnce([]); // Step 3 broadened — nothing left either

      const ids = await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      expect(ids).toEqual(['q1']); // 1, not padded to 5, and never a repeat
    });
  });

  describe('Exam/authority/category/sub-category filtering', () => {
    it('spreads the caller-supplied taxonomyFilter into every query untouched', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([questionRow('q1')]).mockResolvedValueOnce([]);

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      const unseenCallWhere = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(unseenCallWhere.authorityId).toBe('tnpsc');
    });
  });

  describe('Language strictness', () => {
    it('applies the requested language on every query, independent of taxonomyFilter', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([questionRow('q1')]).mockResolvedValueOnce([]);

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'TA', TAXONOMY_FILTER, null);

      for (const call of prismaMock.question.findMany.mock.calls) {
        const where = call[0]?.where as any;
        expect(where.language).toBe('TA');
      }
    });

    it('language is NEVER broadened, even at Step 3s difficulty-broadening fallback', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([]) // unseen at matched difficulty — nothing
        .mockResolvedValueOnce([questionRow('q1')]); // Step 3 broadened

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'TA', TAXONOMY_FILTER, null);

      const step3Where = prismaMock.question.findMany.mock.calls[2][0]?.where as any;
      expect(step3Where.language).toBe('TA');
    });
  });

  describe('Difficulty rules and fallback', () => {
    it('MEDIUM mode requests only MEDIUM difficulty', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`q${i}`)));
      await service.buildSessionQuestionIds(USER_ID, 'MEDIUM', 5, 'EN', TAXONOMY_FILTER, null);
      const where = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(where.difficulty).toEqual({ in: ['MEDIUM'] });
    });

    it('HARD mode requests only HARD difficulty', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`q${i}`)));
      await service.buildSessionQuestionIds(USER_ID, 'HARD', 5, 'EN', TAXONOMY_FILTER, null);
      const where = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(where.difficulty).toEqual({ in: ['HARD'] });
    });

    it('MIXED mode requests both MEDIUM and HARD', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`q${i}`)));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      const where = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(where.difficulty).toEqual({ in: ['MEDIUM', 'HARD'] });
    });

    it('Step 3 fallback broadens to ALL difficulties (no difficulty filter at all) only when the matched-difficulty pool falls short', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1')]) // unseen (HARD only) — short of 5
        .mockResolvedValueOnce([questionRow('q2'), questionRow('q3')]); // Step 3 broadened

      const ids = await service.buildSessionQuestionIds(USER_ID, 'HARD', 5, 'EN', TAXONOMY_FILTER, null);

      const step3Where = prismaMock.question.findMany.mock.calls[2][0]?.where as any;
      expect(step3Where.difficulty).toBeUndefined(); // no difficulty key at all -> ANY difficulty
      expect(ids).toEqual(['q1', 'q2', 'q3']);
    });

    it('Step 3 is skipped entirely when Step 2 already fills the full session', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1'), questionRow('q2'), questionRow('q3'), questionRow('q4'), questionRow('q5')]); // exactly fills 5

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2); // CA + unseen only, no Step 3 call
    });
  });

  describe('Subject Preference 75/25 allocation', () => {
    it('splits the non-CA budget 75/25 (Preferred/General) per the default platform setting', async () => {
      // sessionSize 20 with a preference: CA cap (caMaxFor20Q=3) but CA
      // returns 0 found -> remaining stays 20. Preferred target =
      // round(20*75/100) = 15.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(Array.from({ length: 15 }, (_, i) => questionRow(`p${i}`))) // Preferred: fills its full target
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`g${i}`))); // General: the remaining 5

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      const ids = await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const preferredCallTake = (prismaMock.question.findMany.mock.calls[1][0] as any).take;
      const generalCallTake = (prismaMock.question.findMany.mock.calls[2][0] as any).take;
      expect(preferredCallTake).toBe(15); // 75% of 20
      expect(generalCallTake).toBe(5); // remaining 25%
      expect(ids).toHaveLength(20);
    });

    it('Preferred pool filters by subjectIds/topicIds; General pool does NOT apply that filter at all', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(Array.from({ length: 15 }, (_, i) => questionRow(`p${i}`))) // Preferred fills its target
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`g${i}`))); // General fills the rest

      const preference = { subjectIds: ['subject-1'], topicIds: ['topic-1'] };
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const preferredWhere = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      const generalWhere = prismaMock.question.findMany.mock.calls[2][0]?.where as any;
      expect(preferredWhere.OR).toEqual([
        { syllabusTopicId: { in: ['topic-1'] } },
        { syllabusTopic: { subjectId: { in: ['subject-1'] } } },
      ]);
      expect(generalWhere.OR).toBeUndefined();
    });

    it('an empty preference ({ subjectIds: [], topicIds: [] }) is treated identically to no preference at all (byte-identical query)', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`q${i}`)));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, { subjectIds: [], topicIds: [] });

      // Only 2 calls (CA + plain unseen) -- NOT the 3-call Preferred/General path.
      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('Insufficient preferred-question handling', () => {
    it('when the Preferred pool comes up short of its 75% target, the General pools share grows to absorb the shortfall (session still completes at this Difficulty tier)', async () => {
      // Preferred target = 15 (75% of 20), but only 4 preferred questions exist.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(Array.from({ length: 4 }, (_, i) => questionRow(`p${i}`))) // Preferred: short
        .mockResolvedValueOnce(Array.from({ length: 16 }, (_, i) => questionRow(`g${i}`))); // General absorbs the gap

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      const ids = await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const generalCallTake = (prismaMock.question.findMany.mock.calls[2][0] as any).take;
      expect(generalCallTake).toBe(16); // 20 - 4, not the original 25% (=5)
      expect(ids).toHaveLength(20);
    });

    it('General pool is skipped entirely (no 3rd DB call) when Preferred alone already fills the full remaining budget', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => questionRow(`p${i}`))); // Preferred fills everything

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2); // CA + Preferred only
    });
  });

  describe('Current Affairs handling', () => {
    it('uses caMaxFor5Q for sessionSize <= 5', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`q${i}`)));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      const caCallTake = (prismaMock.question.findMany.mock.calls[0][0] as any).take;
      expect(caCallTake).toBe(DEFAULT_SETTINGS.caMaxFor5Q);
    });

    it('uses caMaxFor20Q for 5 < sessionSize <= 20', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(Array.from({ length: 20 }, (_, i) => questionRow(`q${i}`)));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, null);
      const caCallTake = (prismaMock.question.findMany.mock.calls[0][0] as any).take;
      expect(caCallTake).toBe(DEFAULT_SETTINGS.caMaxFor20Q);
    });

    it('Current Affairs questions are selected by category=CURRENT_AFFAIRS and a recency window, unseen-first', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([questionRow('ca1')]).mockResolvedValueOnce(Array.from({ length: 4 }, (_, i) => questionRow(`q${i}`)));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      const caCall = prismaMock.question.findMany.mock.calls[0][0] as any;
      expect(caCall.where.category).toBe('CURRENT_AFFAIRS');
      expect(caCall.where.relevanceDate).toHaveProperty('gte');
      expect(caCall.where.history).toEqual({ none: { userId: USER_ID } });
    });

    it('Current Affairs is completely independent of Subject/Topic Preference — never filtered by it, even when a preference is saved', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([questionRow('ca1')]) // CA
        .mockResolvedValueOnce(Array.from({ length: 14 }, (_, i) => questionRow(`p${i}`))) // Preferred
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`g${i}`))); // General

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const caWhere = prismaMock.question.findMany.mock.calls[0][0]?.where as any;
      expect(caWhere.OR).toBeUndefined(); // no preferredFilter applied to the CA step
    });

    it('caCap of 0 skips the Current Affairs query entirely', async () => {
      prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue({ ...DEFAULT_SETTINGS, caMaxFor5Q: 0 } as any);
      prismaMock.question.findMany.mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => questionRow(`q${i}`)));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(1); // unseen step only, no CA call at all
    });
  });
});
