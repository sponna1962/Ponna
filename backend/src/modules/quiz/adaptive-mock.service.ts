// Adaptive Mock Test (Sept 2026, differentiated feature — Item 5). See
// schema.prisma's own header comment on AdaptiveMockAttempt for why this
// is a separate system from Live Exam, not a mode bolted onto it.

import { CorrectOption, Difficulty, AdaptiveMockAttemptStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { scopeAccessService, ScopeRestrictedError } from '../quota/scope-access.service';
import { PracticePreferenceService } from '../practice-preference/practice-preference.service';
import { extractFirstSubCategoryId } from '../practice-preference/weak-area.service';

export class AdaptiveMockError extends Error {}

const preferenceService = new PracticePreferenceService();
const DEFAULT_QUESTION_COUNT = 20;
const DURATION_MINUTES = 25;
// A recent-accuracy sample smaller than this isn't a reliable signal --
// falls back to the confidence-building ratio rather than guessing off
// too few data points.
const MIN_HISTORY_FOR_ADAPTATION = 5;
const RECENT_HISTORY_WINDOW = 20;

export class AdaptiveMockService {
  private async hasPaidAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true;
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } },
    });
    return !!activeSub;
  }

  /** Sept 2026 — the core "adaptive" decision. Looks at the student's
   * last RECENT_HISTORY_WINDOW answered questions (any mode, any exam --
   * a broad recent-skill signal, not scoped to one Sub-Category) and
   * buckets their accuracy into one of three bands. Struggling students
   * (or students with too little history to judge yet) get more MEDIUM
   * to build confidence; strong students get more HARD to keep growing.
   * Never anything more granular than these three fixed bands -- a
   * precise "accuracy-to-ratio formula" would imply a tuning precision
   * this hasn't been validated against real outcomes yet. */
  async computeAdaptiveRatio(userId: string, questionCount: number): Promise<{ mediumCount: number; hardCount: number; accuracyUsed: number | null }> {
    const recent = await prisma.userQuestionHistory.findMany({
      where: { userId },
      orderBy: { answeredAt: 'desc' },
      take: RECENT_HISTORY_WINDOW,
      select: { answeredCorrectly: true },
    });

    if (recent.length < MIN_HISTORY_FOR_ADAPTATION) {
      const mediumCount = Math.round(questionCount * 0.85);
      return { mediumCount, hardCount: questionCount - mediumCount, accuracyUsed: null };
    }

    const accuracy = recent.filter((r) => r.answeredCorrectly).length / recent.length;
    let mediumRatio: number;
    if (accuracy >= 0.75) mediumRatio = 0.3;
    else if (accuracy >= 0.5) mediumRatio = 0.6;
    else mediumRatio = 0.85;

    const mediumCount = Math.round(questionCount * mediumRatio);
    return { mediumCount, hardCount: questionCount - mediumCount, accuracyUsed: Math.round(accuracy * 100) };
  }

  private async resolveSubCategoryId(userId: string): Promise<string | null> {
    const preference = await prisma.studentPracticePreference.findUnique({ where: { userId } });
    if (!preference) return null;
    return extractFirstSubCategoryId(preference.selections);
  }

  async getState(userId: string) {
    if (!(await this.hasPaidAccess(userId))) return { access: 'FREE_LOCKED' as const };
    const subCategoryId = await this.resolveSubCategoryId(userId);
    if (!subCategoryId) return { access: 'NO_PREFERENCE' as const };
    try {
      await scopeAccessService.assertSubCategoryAllowed(userId, subCategoryId);
    } catch (e) {
      if (e instanceof ScopeRestrictedError) return { access: 'FREE_LOCKED' as const };
      throw e;
    }

    const existing = await prisma.adaptiveMockAttempt.findFirst({
      where: { userId, subCategoryId, status: 'IN_PROGRESS' },
      orderBy: { startedAt: 'desc' },
    });
    if (existing) {
      if (existing.expiresAt < new Date()) {
        await this.completeAttempt(existing.id, true);
      } else {
        return { access: 'IN_PROGRESS' as const, attemptId: existing.id, expiresAt: existing.expiresAt };
      }
    }
    return { access: 'READY' as const, subCategoryId };
  }

  async startAttempt(userId: string, questionCount: number = DEFAULT_QUESTION_COUNT) {
    if (!(await this.hasPaidAccess(userId))) throw new AdaptiveMockError('Adaptive Mock Test requires an active Annual Plan.');
    const subCategoryId = await this.resolveSubCategoryId(userId);
    if (!subCategoryId) throw new AdaptiveMockError('Please complete Practice Setup first.');
    await scopeAccessService.assertSubCategoryAllowed(userId, subCategoryId);

    const existing = await prisma.adaptiveMockAttempt.findFirst({ where: { userId, subCategoryId, status: 'IN_PROGRESS' } });
    if (existing) throw new AdaptiveMockError('You already have an Adaptive Mock Test in progress for this exam.');

    const preference = await preferenceService.get(userId);
    if (!preference) throw new AdaptiveMockError('Please complete Practice Setup first.');

    const { mediumCount, hardCount } = await this.computeAdaptiveRatio(userId, questionCount);

    const baseWhere = {
      status: 'PUBLISHED' as const,
      language: preference.language,
      auditFlags: { none: { status: { not: 'DISMISSED' as const } } },
      OR: [{ subCategoryId }, { authorityTags: { some: { subCategoryId } } }],
    };

    const [mediumQuestions, hardQuestions] = await Promise.all([
      prisma.question.findMany({ where: { ...baseWhere, difficulty: 'MEDIUM' as Difficulty }, take: mediumCount, orderBy: { createdAt: 'asc' } }),
      prisma.question.findMany({ where: { ...baseWhere, difficulty: 'HARD' as Difficulty }, take: hardCount, orderBy: { createdAt: 'asc' } }),
    ]);

    const questions = [...mediumQuestions, ...hardQuestions];
    if (questions.length < Math.min(questionCount, 5)) {
      throw new AdaptiveMockError('Not enough published questions are available for this exam yet. Please try again later.');
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + DURATION_MINUTES * 60 * 1000);

    const attempt = await prisma.adaptiveMockAttempt.create({
      data: {
        userId,
        subCategoryId,
        startedAt,
        expiresAt,
        totalMarks: questions.length,
        mediumCount: mediumQuestions.length,
        hardCount: hardQuestions.length,
        questions: {
          create: questions.map((q, i) => ({ questionId: q.id, sequenceNumber: i + 1, difficulty: q.difficulty as Difficulty })),
        },
      },
    });

    return attempt;
  }

  async getQuestions(userId: string, attemptId: string) {
    const attempt = await prisma.adaptiveMockAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new AdaptiveMockError('Not your attempt.');

    const rows = await prisma.adaptiveMockQuestion.findMany({
      where: { attemptId },
      orderBy: { sequenceNumber: 'asc' },
      include: { question: true },
    });
    return rows.map((r) => ({
      questionId: r.questionId,
      sequenceNumber: r.sequenceNumber,
      questionText: r.question.questionText,
      optionA: r.question.optionA,
      optionB: r.question.optionB,
      optionC: r.question.optionC,
      optionD: r.question.optionD,
      selectedOption: r.selectedOption,
    }));
  }

  async submitAnswer(userId: string, attemptId: string, questionId: string, selectedOption: CorrectOption, timeSpentSeconds?: number) {
    const attempt = await prisma.adaptiveMockAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new AdaptiveMockError('Not your attempt.');
    if (attempt.status !== 'IN_PROGRESS') throw new AdaptiveMockError('This Adaptive Mock Test has ended.');

    const mockQuestion = await prisma.adaptiveMockQuestion.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId, questionId } } });
    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.adaptiveMockQuestion.update({
      where: { id: mockQuestion.id },
      data: { selectedOption, isCorrect, answeredAt: new Date(), timeSpentSeconds },
    });
    return { isCorrect };
  }

  /** No negative marking, no results-withholding — Adaptive Mock is a
   * practice/skill-building tool, not a real-exam simulation (that's
   * Live Exam's job). Score = number correct out of total. */
  async completeAttempt(attemptId: string, dueToExpiry = false) {
    const questions = await prisma.adaptiveMockQuestion.findMany({ where: { attemptId } });
    const score = questions.filter((q) => q.isCorrect).length;

    return prisma.adaptiveMockAttempt.update({
      where: { id: attemptId },
      data: {
        status: (dueToExpiry ? 'EXPIRED' : 'COMPLETED') as AdaptiveMockAttemptStatus,
        completedAt: new Date(),
        score,
      },
    });
  }

  async getResult(userId: string, attemptId: string) {
    const attempt = await prisma.adaptiveMockAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new AdaptiveMockError('Not your attempt.');
    return attempt;
  }
}

export const adaptiveMockService = new AdaptiveMockService();
