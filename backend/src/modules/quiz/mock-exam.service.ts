// Live Exam / Mock Exam — student-facing engine (finalized requirement,
// ₹999 Annual Plan value-add, item 2 of 3). A genuine timed simulation:
// answers are NEVER revealed until the attempt is completed (unlike
// Daily Quiz/normal Practice) so it actually feels like the real exam.
// Full syllabus coverage -- no Subject Preference weighting, no
// difficulty filtering by mode -- exactly like the real exam draws from
// the whole syllabus. Completely separate from normal Practice: no
// quota, no UserQuestionHistory, no effect on ranking or no-repeat.

import { CorrectOption, MockExamAttemptStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class MockExamError extends Error {}

export class MockExamService {
  private async hasPaidAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true;
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } },
    });
    return !!activeSub;
  }

  /** Live-checks and force-closes an attempt whose time has run out,
   * scoring whatever was answered so far -- the same "never trust a
   * stale status field alone" discipline as Daily Quiz's cron-safety
   * design, just checked inline here since there's no separate sweep job
   * for this (an attempt can only ever be interacted with by its own
   * student, so an inline check on access is sufficient). */
  private async expireIfNeeded(attemptId: string) {
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { questions: true } });
    if (attempt.status === 'IN_PROGRESS' && new Date() >= attempt.expiresAt) {
      await this.finalizeScore(attempt.id, MockExamAttemptStatus.EXPIRED);
    }
  }

  private async finalizeScore(attemptId: string, status: MockExamAttemptStatus) {
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { questions: true } });
    const config = await prisma.mockExamConfig.findUniqueOrThrow({ where: { subCategoryId: attempt.subCategoryId } });

    let score = 0;
    for (const q of attempt.questions) {
      if (q.selectedOption === null) continue; // unanswered — zero, no penalty
      if (q.isCorrect) score += config.marksPerQuestion;
      else score -= config.marksPerQuestion * config.negativeMarkingFraction;
    }

    await prisma.mockExamAttempt.update({
      where: { id: attemptId },
      data: { status, completedAt: new Date(), score },
    });
  }

  async getState(userId: string, subCategoryId: string) {
    if (!(await this.hasPaidAccess(userId))) return { access: 'FREE_LOCKED' as const };

    const config = await prisma.mockExamConfig.findUnique({ where: { subCategoryId } });
    if (!config) return { access: 'NOT_CONFIGURED' as const };

    const existing = await prisma.mockExamAttempt.findFirst({
      where: { userId, subCategoryId },
      orderBy: { startedAt: 'desc' },
    });

    if (existing) {
      await this.expireIfNeeded(existing.id);
      const fresh = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: existing.id } });
      if (fresh.status === 'IN_PROGRESS') {
        return { access: 'IN_PROGRESS' as const, attemptId: fresh.id, expiresAt: fresh.expiresAt, config };
      }
      return {
        access: 'COMPLETED' as const,
        attemptId: fresh.id,
        score: fresh.score,
        totalMarks: fresh.totalMarks,
        wasExpired: fresh.status === 'EXPIRED',
      };
    }

    return { access: 'READY' as const, config };
  }

  async startAttempt(userId: string, subCategoryId: string) {
    if (!(await this.hasPaidAccess(userId))) throw new MockExamError('Live Exam requires an active Annual Plan.');

    const config = await prisma.mockExamConfig.findUnique({ where: { subCategoryId } });
    if (!config) throw new MockExamError('Live Exam is not configured for this exam yet.');

    const existing = await prisma.mockExamAttempt.findFirst({ where: { userId, subCategoryId } });
    if (existing) throw new MockExamError('You have already attempted this Live Exam.'); // one attempt, like the real exam

    const questions = await prisma.question.findMany({
      where: { status: 'PUBLISHED', authorityTags: { some: { subCategoryId } } },
      take: config.questionCount,
      orderBy: { createdAt: 'asc' },
    });
    if (questions.length < config.questionCount) {
      throw new MockExamError('Not enough published questions are available for this exam yet. Please try again later.');
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + config.durationMinutes * 60 * 1000);

    const attempt = await prisma.mockExamAttempt.create({
      data: {
        userId,
        subCategoryId,
        startedAt,
        expiresAt,
        totalMarks: config.questionCount * config.marksPerQuestion,
        questions: {
          create: questions.map((q, i) => ({ questionId: q.id, sequenceNumber: i + 1 })),
        },
      },
    });

    return { attemptId: attempt.id, expiresAt: attempt.expiresAt };
  }

  /** Returns question content WITHOUT correctOption/explanation while the
   * attempt is still in progress — a real exam never tells you if you're
   * right as you go. Only once completed does this reveal everything. */
  async getQuestions(userId: string, attemptId: string) {
    await this.expireIfNeeded(attemptId);
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { questions: { orderBy: { sequenceNumber: 'asc' }, include: { question: true } } },
    });
    if (attempt.userId !== userId) throw new MockExamError('Not your attempt.');

    const isCompleted = attempt.status !== 'IN_PROGRESS';

    return {
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      questions: attempt.questions.map((mq) => ({
        id: mq.questionId,
        sequenceNumber: mq.sequenceNumber,
        questionText: mq.question.questionText,
        optionA: mq.question.optionA,
        optionB: mq.question.optionB,
        optionC: mq.question.optionC,
        optionD: mq.question.optionD,
        selectedOption: mq.selectedOption,
        // Only revealed once the whole attempt is completed — never per-question mid-exam.
        correctOption: isCompleted ? mq.question.correctOption : null,
        explanation: isCompleted ? (mq.question.language === 'TA' ? mq.question.explanationTa : mq.question.explanationEn) : null,
      })),
    };
  }

  async submitAnswer(userId: string, attemptId: string, questionId: string, selectedOption: CorrectOption) {
    await this.expireIfNeeded(attemptId);
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new MockExamError('Not your attempt.');
    if (attempt.status !== 'IN_PROGRESS') throw new MockExamError('This Live Exam has ended.');

    const mockQuestion = await prisma.mockExamQuestion.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId, questionId } } });
    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.mockExamQuestion.update({
      where: { id: mockQuestion.id },
      data: { selectedOption, isCorrect, answeredAt: new Date() },
    });

    // Deliberately does NOT return isCorrect/correctOption to the caller
    // -- a real exam gives no feedback as you answer.
    return { saved: true };
  }

  async submitExam(userId: string, attemptId: string) {
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new MockExamError('Not your attempt.');
    if (attempt.status !== 'IN_PROGRESS') throw new MockExamError('This Live Exam has already ended.');

    await this.finalizeScore(attemptId, MockExamAttemptStatus.COMPLETED);
    const final = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    return { score: final.score, totalMarks: final.totalMarks };
  }
}
