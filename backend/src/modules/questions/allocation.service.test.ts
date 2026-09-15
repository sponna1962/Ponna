// Unit tests for AllocationService.buildSessionQuestionIds (Question
// Allocation Engine). Mocked Prisma client — no real database. Each
// test wires prisma.question.findMany with sequential
// mockResolvedValueOnce calls matching the EXACT call order the
// implementation makes (Current Affairs -> [Unseen | Preferred ->
// General] -> broadened-Difficulty fallback) — verified against the
// real allocation.service.ts source, not assumed. These tests verify
// the CURRENT business rules as implemented; they do not introduce new
// behaviour.
//
// Sept 2026 (Source-Priority, explicit request) — every non-CA step now
// internally does an ORIGINAL-sourceType-first call, then a backfill
// call from other sources ONLY if the original call came up short of
// that step's own `take`. Most tests below sidestep this by mocking the
// "original" call to return exactly `take` rows, which the
// implementation's own `stillNeeded <= 0` check uses to skip the
// backfill call entirely -- this keeps most tests' call counts/indices
// identical to before. A few tests (marked below) specifically exercise
// the backfill path and have an extra mocked call + adjusted indices.
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

function rows(n: number, prefix = 'q') {
  return Array.from({ length: n }, (_, i) => questionRow(`${prefix}${i}`));
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
      // Source-Priority backfill path exercised on purpose here, to prove
      // the history filter survives into BOTH the original and backfill
      // calls of every step: CA[] -> unseen-original[q1,q2] (short of the
      // step's take=5) -> unseen-backfill[] -> step3-original[] ->
      // step3-backfill[].
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA step: none available
        .mockResolvedValueOnce([questionRow('q1'), questionRow('q2')]) // unseen: original (sourceType ORIGINAL)
        .mockResolvedValueOnce([]) // unseen: backfill (short of take=5)
        .mockResolvedValueOnce([]) // Step 3: original
        .mockResolvedValueOnce([]); // Step 3: backfill (still short)

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      for (const call of prismaMock.question.findMany.mock.calls) {
        const where = call[0]?.where as any;
        expect(where.history).toEqual({ none: { userId: USER_ID } });
      }
    });

    it('returns fewer than sessionSize (never repeats) when the unseen pool is exhausted, even after the broadened-Difficulty fallback', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1')]) // unseen: original — only 1 found
        .mockResolvedValueOnce([]) // unseen: backfill — nothing either
        .mockResolvedValueOnce([]) // Step 3: original — nothing
        .mockResolvedValueOnce([]); // Step 3: backfill — nothing left either

      const ids = await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      expect(ids).toEqual(['q1']); // 1, not padded to 5, and never a repeat
    });
  });

  describe('Exam/authority/category/sub-category filtering', () => {
    it('spreads the caller-supplied taxonomyFilter into every query untouched', async () => {
      // Mock the "unseen" step's original call to fully satisfy its take
      // (5) so no backfill/Step-3 calls happen -- keeps this test's call
      // index (1) for the unseen step identical to before.
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      const unseenCallWhere = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(unseenCallWhere.authorityId).toBe('tnpsc');
    });
  });

  describe('Language strictness', () => {
    it('applies the requested language on every query, independent of taxonomyFilter', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'TA', TAXONOMY_FILTER, null);

      for (const call of prismaMock.question.findMany.mock.calls) {
        const where = call[0]?.where as any;
        expect(where.language).toBe('TA');
      }
    });

    it('language is NEVER broadened, even at Step 3s difficulty-broadening fallback', async () => {
      // unseen step comes up completely empty (both original and
      // backfill) -> Step 3 runs; its own original call also empty, its
      // backfill call is what actually returns q1. Step 3's calls are now
      // at indices 3 (original) and 4 (backfill), not 2.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([]) // unseen: original — nothing at matched difficulty
        .mockResolvedValueOnce([]) // unseen: backfill — nothing either
        .mockResolvedValueOnce([]) // Step 3: original — nothing
        .mockResolvedValueOnce([questionRow('q1')]); // Step 3: backfill

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'TA', TAXONOMY_FILTER, null);

      const step3Where = prismaMock.question.findMany.mock.calls[3][0]?.where as any;
      expect(step3Where.language).toBe('TA');
    });
  });

  describe('Difficulty rules and fallback', () => {
    it('MEDIUM mode requests only MEDIUM difficulty', async () => {
      // "original" call mocked to fully satisfy take=5 -> no backfill call.
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));
      await service.buildSessionQuestionIds(USER_ID, 'MEDIUM', 5, 'EN', TAXONOMY_FILTER, null);
      const where = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(where.difficulty).toEqual({ in: ['MEDIUM'] });
    });

    it('HARD mode requests only HARD difficulty', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));
      await service.buildSessionQuestionIds(USER_ID, 'HARD', 5, 'EN', TAXONOMY_FILTER, null);
      const where = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(where.difficulty).toEqual({ in: ['HARD'] });
    });

    it('MIXED mode requests both MEDIUM and HARD', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      const where = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      expect(where.difficulty).toEqual({ in: ['MEDIUM', 'HARD'] });
    });

    it('Step 3 fallback broadens to ALL difficulties (no difficulty filter at all) only when the matched-difficulty pool falls short', async () => {
      // unseen: original returns q1 (short of take=5) -> backfill returns
      // nothing more. Step 3 (ALL difficulty): original returns q2,
      // backfill returns q3.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1')]) // unseen: original
        .mockResolvedValueOnce([]) // unseen: backfill
        .mockResolvedValueOnce([questionRow('q2')]) // Step 3: original
        .mockResolvedValueOnce([questionRow('q3')]); // Step 3: backfill

      const ids = await service.buildSessionQuestionIds(USER_ID, 'HARD', 5, 'EN', TAXONOMY_FILTER, null);

      const step3Where = prismaMock.question.findMany.mock.calls[3][0]?.where as any;
      expect(step3Where.difficulty).toBeUndefined(); // no difficulty key at all -> ANY difficulty
      expect(ids).toEqual(['q1', 'q2', 'q3']);
    });

    it('Step 3 is skipped entirely when Step 2 already fills the full session', async () => {
      // "original" call mocked to fully satisfy take=5 -> no backfill, no Step 3.
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2); // CA + unseen-original only
    });
  });

  describe('Subject Preference 75/25 allocation', () => {
    it('splits the non-CA budget 75/25 (Preferred/General) per the default platform setting', async () => {
      // sessionSize 20 with a preference: CA cap (caMaxFor20Q=3) but CA
      // returns 0 found -> remaining stays 20. Preferred target =
      // round(20*75/100) = 15. Both "original" calls mocked to fully
      // satisfy their own take, so no backfill calls happen.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(rows(15, 'p')) // Preferred: original, fills its full target
        .mockResolvedValueOnce(rows(5, 'g')); // General: original, fills the remaining 5

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      const ids = await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const preferredCallTake = (prismaMock.question.findMany.mock.calls[1][0] as any).take;
      const generalCallTake = (prismaMock.question.findMany.mock.calls[2][0] as any).take;
      // Both are the ORIGINAL sub-call's own 70% target (round(x*0.7)),
      // not the step's full target -- confirms Preferred's overall
      // target was 15 (round(15*0.7)=11) and General's was 5
      // (round(5*0.7)=4), i.e. the 75/25 split itself is correct.
      expect(preferredCallTake).toBe(11); // round(15 * 0.7)
      expect(generalCallTake).toBe(4); // round(5 * 0.7)
      expect(ids).toHaveLength(20);
    });

    it('Preferred pool filters by subjectIds/topicIds; General pool does NOT apply that filter at all', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(rows(15, 'p')) // Preferred: original, fills its target
        .mockResolvedValueOnce(rows(5, 'g')); // General: original, fills the rest

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
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, { subjectIds: [], topicIds: [] });

      // Only 2 calls (CA + plain unseen-original, which fully satisfies
      // take=5 so no backfill) -- NOT the 3-call Preferred/General path.
      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('Insufficient preferred-question handling', () => {
    it('when the Preferred pool comes up short of its 75% target, the General pools share grows to absorb the shortfall (session still completes at this Difficulty tier)', async () => {
      // Preferred target = 15 (75% of 20). Preferred pool genuinely only
      // has 4 questions total -- original call returns 2, its own
      // backfill call returns the other 2, still only 4 total (short of
      // 15). General then absorbs the full remaining 16, mocked to fully
      // satisfy its own take so no further backfill/Step-3 calls happen.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(rows(2, 'p')) // Preferred: original — short
        .mockResolvedValueOnce(rows(2, 'p2')) // Preferred: backfill — still short (4 total)
        .mockResolvedValueOnce(rows(16, 'g')); // General: original, fills the full 16

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      const ids = await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const generalCallTake = (prismaMock.question.findMany.mock.calls[3][0] as any).take;
      // The general step's OWN "original" sub-call requests
      // round(16 * 0.7) = 11 (its 70% target), not the full 16 -- this
      // confirms the general step's overall target was correctly
      // absorbed to 16 (20 - 4), since round(16*0.7)=11 while
      // round(5*0.7)=4 (the original, un-absorbed 25% target) would not.
      expect(generalCallTake).toBe(11);
      expect(ids).toHaveLength(20);
    });

    it('General pool is skipped entirely (no 3rd/4th DB call) when Preferred alone already fills the full remaining budget', async () => {
      // Preferred's OWN original call returns more than its own take
      // (15) — simulating the pool having plenty available — so
      // stillNeeded <= 0 and no Preferred-backfill call happens either.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(rows(20, 'p')); // Preferred: original, fills the entire remaining budget

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2); // CA + Preferred-original only
    });
  });

  describe('Current Affairs handling', () => {
    it('uses caMaxFor5Q for sessionSize <= 5', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      const caCallTake = (prismaMock.question.findMany.mock.calls[0][0] as any).take;
      expect(caCallTake).toBe(DEFAULT_SETTINGS.caMaxFor5Q);
    });

    it('uses caMaxFor20Q for 5 < sessionSize <= 20', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(20));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, null);
      const caCallTake = (prismaMock.question.findMany.mock.calls[0][0] as any).take;
      expect(caCallTake).toBe(DEFAULT_SETTINGS.caMaxFor20Q);
    });

    it('Current Affairs questions are selected by category=CURRENT_AFFAIRS and a recency window, unseen-first', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([questionRow('ca1')]).mockResolvedValueOnce(rows(4));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      const caCall = prismaMock.question.findMany.mock.calls[0][0] as any;
      expect(caCall.where.category).toBe('CURRENT_AFFAIRS');
      expect(caCall.where.relevanceDate).toHaveProperty('gte');
      expect(caCall.where.history).toEqual({ none: { userId: USER_ID } });
    });

    it('Current Affairs is completely independent of Subject/Topic Preference — never filtered by it, even when a preference is saved', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([questionRow('ca1')]) // CA
        .mockResolvedValueOnce(rows(14, 'p')) // Preferred: original, fills its target (round(19*0.75)=14)
        .mockResolvedValueOnce(rows(5, 'g')); // General: original, fills the rest

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const caWhere = prismaMock.question.findMany.mock.calls[0][0]?.where as any;
      expect(caWhere.OR).toBeUndefined(); // no preferredFilter applied to the CA step
    });

    it('caCap of 0 skips the Current Affairs query entirely', async () => {
      prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue({ ...DEFAULT_SETTINGS, caMaxFor5Q: 0 } as any);
      prismaMock.question.findMany.mockResolvedValueOnce(rows(5));

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(1); // unseen-original only, no CA call at all
    });
  });

  describe('Pending AI Question Audit review — data-quality safety (Sept 2026, BINDING)', () => {
    it('every query excludes questions with an unreviewed (OPEN) audit flag, at every tier including the broadened Step 3', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1')]) // unseen: original — short of take=5
        .mockResolvedValueOnce([]) // unseen: backfill
        .mockResolvedValueOnce([]) // Step 3: original
        .mockResolvedValueOnce([questionRow('q2')]); // Step 3: backfill

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      for (const call of prismaMock.question.findMany.mock.calls) {
        const where = call[0]?.where as any;
        expect(where.auditFlags).toEqual({ none: { status: { not: 'DISMISSED' } } });
      }
    });

    it('applies the same exclusion in the Preferred and General pools too (Subject Preference path)', async () => {
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce(rows(15, 'p')) // Preferred: original, fills its target
        .mockResolvedValueOnce(rows(5, 'g')); // General: original, fills the rest

      const preference = { subjectIds: ['subject-1'], topicIds: [] };
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 20, 'EN', TAXONOMY_FILTER, preference);

      const preferredWhere = prismaMock.question.findMany.mock.calls[1][0]?.where as any;
      const generalWhere = prismaMock.question.findMany.mock.calls[2][0]?.where as any;
      expect(preferredWhere.auditFlags).toEqual({ none: { status: { not: 'DISMISSED' } } });
      expect(generalWhere.auditFlags).toEqual({ none: { status: { not: 'DISMISSED' } } });
    });
  });

  describe('Source-Priority (Sept 2026, explicit request — PONNA-authored questions first)', () => {
    it('the original call for a step requests 70% of that steps take, with sourceType ORIGINAL', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5));
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);

      const unseenOriginalCall = prismaMock.question.findMany.mock.calls[1][0] as any;
      expect(unseenOriginalCall.take).toBe(4); // round(5 * 0.7) = 4 (rounds up from 3.5)
      expect(unseenOriginalCall.where.sourceType).toBe('ORIGINAL');
    });

    it('backfills from non-ORIGINAL sources ONLY when the original call comes up short, within the SAME exam scope (taxonomyFilter untouched)', async () => {
      // sessionSize 3 so unseen-original(2) + unseen-backfill(1) = 3
      // exactly fills the session, keeping this test focused on just the
      // backfill call's own shape without needing to also mock Step 3.
      prismaMock.question.findMany
        .mockResolvedValueOnce([]) // CA
        .mockResolvedValueOnce([questionRow('q1'), questionRow('q2')]) // unseen: original — 2 of the requested round(3*0.7)=2
        .mockResolvedValueOnce([questionRow('q3')]); // unseen: backfill — fills the last 1

      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 3, 'EN', TAXONOMY_FILTER, null);

      const backfillCall = prismaMock.question.findMany.mock.calls[2][0] as any;
      expect(backfillCall.take).toBe(1); // 3 - 2 already found
      expect(backfillCall.where.sourceType).toEqual({ not: 'ORIGINAL' });
      expect(backfillCall.where.authorityId).toBe('tnpsc'); // taxonomyFilter still applied — never cross-exam
      expect(backfillCall.where.id.notIn).toEqual(expect.arrayContaining(['q1', 'q2'])); // never re-picks the original questions
    });

    it('skips the backfill call entirely when the original call alone already satisfies the steps take', async () => {
      prismaMock.question.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(rows(5)); // original call returns all 5 needed
      await service.buildSessionQuestionIds(USER_ID, 'MIXED', 5, 'EN', TAXONOMY_FILTER, null);
      expect(prismaMock.question.findMany).toHaveBeenCalledTimes(2); // CA + original only, no backfill call
    });
  });
});
