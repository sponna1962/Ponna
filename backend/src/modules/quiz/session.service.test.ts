// Unit tests for SessionService (Quiz Session Engine): startSession,
// submitAnswer, completeSession. Mocked Prisma client — no real
// database. Also mocks the collaborator services session.service.ts
// itself imports (AllocationService, QuotaService, RankingService,
// PracticePreferenceService, MistakeReviewService, streak/milestone) so
// these tests isolate SessionService's own orchestration logic, not
// re-test those collaborators (already covered in their own test
// files). These tests verify the CURRENT business rules as implemented;
// they do not introduce new behaviour.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

jest.mock('../questions/allocation.service');
jest.mock('../ranking/ranking.service');
jest.mock('../practice-preference/practice-preference.service');
jest.mock('../questions/mistake-review.service');
jest.mock('../practice-preference/streak.service');
jest.mock('../practice-preference/milestone.service');

import { prisma } from '../../lib/prisma';
import { SessionService } from './session.service';
import { AllocationService } from '../questions/allocation.service';
import { QuotaService } from '../quota/quota.service';
import { RankingService } from '../ranking/ranking.service';
import { PracticePreferenceService } from '../practice-preference/practice-preference.service';
import { MistakeReviewService } from '../questions/mistake-review.service';
import { recordStreakActivity } from '../practice-preference/streak.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

// The mocked collaborator classes' prototype methods — session.service.ts
// instantiates its own `new AllocationService()` etc. at module load, so
// we get at the SAME mocked instance via the mocked constructor's
// `.mock.instances[0]`, exactly like the real module does internally.
const allocationInstance = (AllocationService as unknown as jest.Mock).mock.instances[0] ?? new (AllocationService as any)();
const rankingInstance = (RankingService as unknown as jest.Mock).mock.instances[0] ?? new (RankingService as any)();
const preferenceInstance = (PracticePreferenceService as unknown as jest.Mock).mock.instances[0] ?? new (PracticePreferenceService as any)();
const mistakeReviewInstance = (MistakeReviewService as unknown as jest.Mock).mock.instances[0] ?? new (MistakeReviewService as any)();

// QuotaService is deliberately NOT module-auto-mocked (unlike the
// collaborators above) — a blanket jest.mock() would also replace the
// real QuotaExceededError class with an auto-mocked stub, breaking
// `throw new QuotaExceededError(...)` inside session.service.ts (the
// thrown value would no longer be a real Error with the right message).
// Spying on the prototype instead keeps QuotaExceededError real.
const getRemainingQuotaSpy = jest.spyOn(QuotaService.prototype, 'getRemainingQuota');
const getBlockedReasonSpy = jest.spyOn(QuotaService.prototype, 'getBlockedReason');
const reserveQuotaSpy = jest.spyOn(QuotaService.prototype, 'reserveQuota');
const onSessionAbandonedSpy = jest.spyOn(QuotaService.prototype, 'onSessionAbandoned').mockResolvedValue(undefined);

const USER_ID = 'user-1';
const SESSION_ID = 'session-1';
const QUESTION_ID = 'question-1';

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
    service = new SessionService();
    prismaMock.$transaction.mockImplementation(((ops: any) => Promise.all(ops)) as any);
  });

  describe('startSession', () => {
    function wireHappyPathPreference() {
      (preferenceInstance.get as jest.Mock).mockResolvedValue({
        language: 'EN',
        mode: 'MIXED',
        selections: { purposeId: 'p1', allAuthorities: false, authorities: [] },
      });
      (preferenceInstance.resolveTaxonomyFilter as jest.Mock).mockReturnValue({});
      (preferenceInstance.extractSingleSubCategoryId as jest.Mock).mockReturnValue(null);
      prismaMock.quizSession.findFirst.mockResolvedValue(null); // no existing in-progress session
    }

    it('throws when no Practice Preference has been saved yet', async () => {
      (preferenceInstance.get as jest.Mock).mockResolvedValue(null);
      await expect(service.startSession(USER_ID)).rejects.toThrow(/complete Practice Setup/i);
    });

    it('resumes an existing IN_PROGRESS session in the SAME language, without touching quota or allocation again', async () => {
      (preferenceInstance.get as jest.Mock).mockResolvedValue({ language: 'EN', mode: 'MIXED', selections: {} });
      prismaMock.quizSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        practiceLanguage: 'EN',
        questions: [{ id: 'q1' }],
      } as any);

      const result = await service.startSession(USER_ID);

      expect(result.resumedWithDifferentSelection).toBe(false);
      expect(reserveQuotaSpy).not.toHaveBeenCalled();
      expect(allocationInstance.buildSessionQuestionIds).not.toHaveBeenCalled();
    });

    it('abandons and rebuilds when the existing session language no longer matches the current preference', async () => {
      (preferenceInstance.get as jest.Mock).mockResolvedValue({
        language: 'TA', // student switched language since starting the old session
        mode: 'MIXED',
        selections: { purposeId: 'p1', allAuthorities: false, authorities: [] },
      });
      (preferenceInstance.resolveTaxonomyFilter as jest.Mock).mockReturnValue({});
      (preferenceInstance.extractSingleSubCategoryId as jest.Mock).mockReturnValue(null);
      prismaMock.quizSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        practiceLanguage: 'EN', // stale language
        questions: [{ id: 'q1' }],
      } as any);
      getRemainingQuotaSpy.mockResolvedValue(10);
      (allocationInstance.buildSessionQuestionIds as jest.Mock).mockResolvedValue(['qa', 'qb']);
      reserveQuotaSpy.mockResolvedValue({ allowed: true, remaining: 8 });
      prismaMock.quizSession.create.mockResolvedValue({ id: 'session-2', questions: [] } as any);

      await service.startSession(USER_ID);

      expect(prismaMock.quizSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SESSION_ID }, data: expect.objectContaining({ status: 'ABANDONED' }) }),
      );
      expect(allocationInstance.buildSessionQuestionIds).toHaveBeenCalled(); // a fresh one WAS built
    });

    it('abandons and rebuilds an existing session that has zero questions (broken session)', async () => {
      wireHappyPathPreference();
      prismaMock.quizSession.findFirst.mockResolvedValue({ id: SESSION_ID, practiceLanguage: 'EN', questions: [] } as any);
      getRemainingQuotaSpy.mockResolvedValue(10);
      (allocationInstance.buildSessionQuestionIds as jest.Mock).mockResolvedValue(['qa']);
      reserveQuotaSpy.mockResolvedValue({ allowed: true, remaining: 9 });
      prismaMock.quizSession.create.mockResolvedValue({ id: 'session-2', questions: [] } as any);

      await service.startSession(USER_ID);

      expect(prismaMock.quizSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ABANDONED' }) }),
      );
    });

    it('throws QuotaExceededError before allocation is even attempted when remaining quota is already 0', async () => {
      wireHappyPathPreference();
      getRemainingQuotaSpy.mockResolvedValue(0);
      getBlockedReasonSpy.mockResolvedValue({ reason: 'Free limit used', code: 'FREE_PREVIEW_ALREADY_USED' });

      await expect(service.startSession(USER_ID)).rejects.toThrow('Free limit used');
      expect(allocationInstance.buildSessionQuestionIds).not.toHaveBeenCalled();
    });

    it('builds the eligible question list BEFORE reserving quota — never reserves quota for questions that cannot be delivered', async () => {
      wireHappyPathPreference();
      getRemainingQuotaSpy.mockResolvedValue(20);
      (allocationInstance.buildSessionQuestionIds as jest.Mock).mockResolvedValue(['q1', 'q2']);
      reserveQuotaSpy.mockResolvedValue({ allowed: true, remaining: 18 });
      prismaMock.quizSession.create.mockResolvedValue({ id: SESSION_ID, questions: [] } as any);

      await service.startSession(USER_ID);

      // reserveQuota is called with the ACTUAL allocated size (2), not the
      // originally-requested ceiling.
      expect(reserveQuotaSpy).toHaveBeenCalledWith(USER_ID, 2, expect.anything());
    });

    it('throws when allocation finds zero eligible questions, WITHOUT ever calling reserveQuota', async () => {
      wireHappyPathPreference();
      getRemainingQuotaSpy.mockResolvedValue(20);
      (allocationInstance.buildSessionQuestionIds as jest.Mock).mockResolvedValue([]);

      await expect(service.startSession(USER_ID)).rejects.toThrow(/No eligible questions/i);
      expect(reserveQuotaSpy).not.toHaveBeenCalled();
    });

    it('throws QuotaExceededError if reserveQuota itself is rejected (e.g. a race consumed the remaining quota)', async () => {
      wireHappyPathPreference();
      getRemainingQuotaSpy.mockResolvedValue(20);
      (allocationInstance.buildSessionQuestionIds as jest.Mock).mockResolvedValue(['q1']);
      reserveQuotaSpy.mockResolvedValue({ allowed: false, reason: 'raced out', remaining: 0 });

      await expect(service.startSession(USER_ID)).rejects.toThrow('raced out');
    });
  });

  describe('submitAnswer', () => {
    function wireHappyPathAnswer(overrides: { isCorrect?: boolean } = {}) {
      const isCorrect = overrides.isCorrect ?? true;
      prismaMock.quizSession.findUniqueOrThrow.mockResolvedValue({
        id: SESSION_ID,
        userId: USER_ID,
        status: 'IN_PROGRESS',
        mode: 'MIXED',
      } as any);
      prismaMock.question.findUniqueOrThrow.mockResolvedValue({
        id: QUESTION_ID,
        correctOption: isCorrect ? 'A' : 'B',
        difficulty: 'MEDIUM',
      } as any);
      // Idempotency guard's own lookup — "not yet answered" by default;
      // individual tests override this for the already-answered case.
      prismaMock.quizSessionQuestion.findUniqueOrThrow.mockResolvedValue({ answered: false, isCorrect: null } as any);
    }

    it('rejects answering into a session that is not IN_PROGRESS', async () => {
      prismaMock.quizSession.findUniqueOrThrow.mockResolvedValue({ id: SESSION_ID, status: 'COMPLETED' } as any);
      await expect(service.submitAnswer(SESSION_ID, QUESTION_ID, 'A')).rejects.toThrow(/not in progress/i);
    });

    it('correctly determines isCorrect by comparing the selected option to the questions correctOption', async () => {
      wireHappyPathAnswer({ isCorrect: true });
      const result = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
      expect(result.isCorrect).toBe(true);
      expect(result.correctOption).toBe('A');
    });

    it('a wrong answer is correctly flagged incorrect', async () => {
      wireHappyPathAnswer({ isCorrect: false }); // correctOption is 'B'
      const result = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
      expect(result.isCorrect).toBe(false);
    });

    describe('Performance recording', () => {
      it('records into UserQuestionHistory via upsert (unique on userId+questionId)', async () => {
        wireHappyPathAnswer();
        await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
        expect(prismaMock.userQuestionHistory.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ where: { userId_questionId: { userId: USER_ID, questionId: QUESTION_ID } } }),
        );
      });

      it('updates the performance summary via RankingService.updateSummaryAfterAnswer with the questions actual difficulty and correctness', async () => {
        wireHappyPathAnswer({ isCorrect: true });
        await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
        expect(rankingInstance.updateSummaryAfterAnswer).toHaveBeenCalledWith(USER_ID, 'MEDIUM', true);
      });

      it('a wrong answer records into Review Mistakes (recordMistake)', async () => {
        wireHappyPathAnswer({ isCorrect: false });
        await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
        expect(mistakeReviewInstance.recordMistake).toHaveBeenCalledWith(USER_ID, QUESTION_ID);
      });

      it('a CORRECT answer does NOT record into Review Mistakes', async () => {
        wireHappyPathAnswer({ isCorrect: true });
        await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
        expect(mistakeReviewInstance.recordMistake).not.toHaveBeenCalled();
      });

      it('records streak activity for any answered question, correct or not', async () => {
        wireHappyPathAnswer({ isCorrect: false });
        await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
        expect(recordStreakActivity).toHaveBeenCalledWith(USER_ID);
      });
    });

    describe('Duplicate submission / idempotency — FIX VERIFIED (Sept 2026)', () => {
      it('first submission for a question processes normally and records the answer', async () => {
        wireHappyPathAnswer({ isCorrect: true });
        // findUniqueOrThrow returns "not yet answered" -> the guard lets it through.
        prismaMock.quizSessionQuestion.findUniqueOrThrow.mockResolvedValueOnce({ answered: false, isCorrect: null } as any);

        const result = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');

        expect(result).toEqual({ isCorrect: true, correctOption: 'A' });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(rankingInstance.updateSummaryAfterAnswer).toHaveBeenCalledTimes(1);
      });

      it('an IDENTICAL duplicate submission (e.g. accidental double-tap) is detected and skipped BEFORE any write — same result returned, zero re-processing', async () => {
        wireHappyPathAnswer({ isCorrect: true });
        // The guard's own lookup now reports "already answered, correctly".
        prismaMock.quizSessionQuestion.findUniqueOrThrow.mockResolvedValue({ answered: true, isCorrect: true } as any);

        const result = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');

        expect(result).toEqual({ isCorrect: true, correctOption: 'A' });
        // Nothing below the guard ran at all.
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
        expect(prismaMock.userQuestionHistory.upsert).not.toHaveBeenCalled();
        expect(rankingInstance.updateSummaryAfterAnswer).not.toHaveBeenCalled();
        expect(mistakeReviewInstance.recordMistake).not.toHaveBeenCalled();
        expect(recordStreakActivity).not.toHaveBeenCalled();
      });

      it('a duplicate submission after a NETWORK RETRY (first request actually succeeded server-side, client just never saw the response and retried) is handled exactly as the double-tap case — idempotent, no double-counting', async () => {
        wireHappyPathAnswer({ isCorrect: false }); // correctOption is 'B' in this setup
        // First request: not yet answered -> processes normally.
        prismaMock.quizSessionQuestion.findUniqueOrThrow.mockResolvedValueOnce({ answered: false, isCorrect: null } as any);
        // The "network retry": by the time this second identical request
        // arrives, the first one already completed and recorded the answer.
        prismaMock.quizSessionQuestion.findUniqueOrThrow.mockResolvedValueOnce({ answered: true, isCorrect: false } as any);

        const first = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');
        const retried = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'A');

        expect(first).toEqual({ isCorrect: false, correctOption: 'B' });
        expect(retried).toEqual({ isCorrect: false, correctOption: 'B' }); // same result, not reprocessed

        // Confirm nothing was double-counted (Performance/ranking/quota/mistakes):
        expect(rankingInstance.updateSummaryAfterAnswer).toHaveBeenCalledTimes(1); // NOT 2 -> accuracy not double-updated
        expect(prismaMock.userQuestionHistory.upsert).toHaveBeenCalledTimes(1); // NOT 2 -> questionsAnswered not double-counted
        expect(mistakeReviewInstance.recordMistake).toHaveBeenCalledTimes(1); // NOT 2 -> no duplicate mistake record
        expect(recordStreakActivity).toHaveBeenCalledTimes(1); // NOT 2
        // Quota is consumed once per SESSION at startSession() time, never
        // per-answer -- submitAnswer never touches quota at all, so there is
        // nothing here to double-consume by construction (not just by this fix).
      });

      it('a duplicate submission with a DIFFERENT selectedOption than the original is still idempotent — the ORIGINAL recorded answer wins, never overwritten by a later duplicate', async () => {
        wireHappyPathAnswer({ isCorrect: true }); // correctOption is 'A'
        // Already answered with 'A' (correct) on the first, real submission.
        prismaMock.quizSessionQuestion.findUniqueOrThrow.mockResolvedValue({ answered: true, isCorrect: true } as any);

        // A duplicate request arrives claiming a different option ('B') --
        // e.g. a retried request racing with a UI state change. The guard
        // fires purely on "already answered", before selectedOption is even
        // compared against anything.
        const result = await service.submitAnswer(SESSION_ID, QUESTION_ID, 'B');

        expect(result).toEqual({ isCorrect: true, correctOption: 'A' }); // the ORIGINAL result, not re-evaluated against 'B'
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
      });
    });
  });

  describe('completeSession', () => {
    it('marks the session COMPLETED with a completedAt timestamp', async () => {
      prismaMock.quizSession.update.mockResolvedValue({ id: SESSION_ID, status: 'COMPLETED' } as any);
      await service.completeSession(SESSION_ID);
      expect(prismaMock.quizSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SESSION_ID }, data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });
  });

  describe('sweepAbandonedSessions', () => {
    it('abandons every session past the inactivity cutoff and never refunds quota', async () => {
      prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue({ sessionInactivityHours: 2 } as any);
      prismaMock.quizSession.findMany.mockResolvedValue([{ id: 'stale-1' }, { id: 'stale-2' }] as any);
      prismaMock.quizSession.update.mockResolvedValue({} as any);

      const result = await service.sweepAbandonedSessions();

      expect(result.abandonedCount).toBe(2);
      expect(prismaMock.quizSession.update).toHaveBeenCalledTimes(2);
      expect(onSessionAbandonedSpy).toHaveBeenCalledTimes(2);
    });

    it('does nothing when there are no stale sessions', async () => {
      prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue({ sessionInactivityHours: 2 } as any);
      prismaMock.quizSession.findMany.mockResolvedValue([] as any);

      const result = await service.sweepAbandonedSessions();
      expect(result.abandonedCount).toBe(0);
      expect(prismaMock.quizSession.update).not.toHaveBeenCalled();
    });
  });
});
