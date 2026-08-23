// Quiz Session Engine — implements §4.3 (Taking a Quiz) session lifecycle:
// start (reserve quota + questions), resume, answer, complete, and the
// scheduled abandonment sweep.

import { PrismaClient, QuizMode, SessionStatus, CorrectOption } from '@prisma/client';
import { QuotaService, QuotaExceededError } from '../quota/quota.service';
import { AllocationService } from '../questions/allocation.service';
import { RankingService } from '../ranking/ranking.service';

const prisma = new PrismaClient();
const quota = new QuotaService();
const allocation = new AllocationService();
const ranking = new RankingService();

export class SessionService {
  /** Starts a new session, or returns the existing in-progress one if present. */
  async startSession(userId: string, mode: QuizMode, requestedSize: number) {
    const existing = await prisma.quizSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
      include: { questions: { orderBy: { sequenceNumber: 'asc' } } },
    });
    if (existing) {
      // §4.3: same session resumes exactly where the student left off, no re-deduction
      return existing;
    }

    // Build the eligible question list FIRST, before touching quota. This is
    // a deliberate fix over an earlier version of this method, which reserved
    // the full requested quota up front and only then discovered the bank
    // didn't have enough questions — charging the student for questions they
    // could never receive. Quota is now reserved for the ACTUAL session size.
    const questionIds = await allocation.buildSessionQuestionIds(userId, mode, requestedSize);
    const actualSize = questionIds.length;

    if (actualSize === 0) {
      throw new Error('No eligible questions are available for this mode right now. Please try a different mode or check back later.');
    }

    const quotaResult = await quota.reserveQuota(userId, actualSize);
    if (!quotaResult.allowed) {
      throw new QuotaExceededError(quotaResult.reason ?? 'Quota exceeded');
    }

    const session = await prisma.quizSession.create({
      data: {
        userId,
        mode,
        totalQuestions: actualSize,
        status: SessionStatus.IN_PROGRESS,
        questions: {
          create: questionIds.map((questionId, idx) => ({
            questionId,
            sequenceNumber: idx + 1,
          })),
        },
      },
      include: { questions: { orderBy: { sequenceNumber: 'asc' } } },
    });

    return {
      ...session,
      // Lets the frontend show "Only 12 of 20 questions available right now"
      // instead of silently serving a shorter session.
      requestedSize,
      shortfall: requestedSize - actualSize,
    };
  }

  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedOption: CorrectOption,
  ) {
    const session = await prisma.quizSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new Error('Cannot answer into a session that is not in progress');
    }

    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.$transaction([
      prisma.quizSessionQuestion.update({
        where: { sessionId_questionId: { sessionId, questionId } },
        data: { answered: true, selectedOption, isCorrect, answeredAt: new Date() },
      }),
      prisma.quizSession.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
      }),
      prisma.userQuestionHistory.upsert({
        where: { userId_questionId: { userId: session.userId, questionId } },
        create: {
          userId: session.userId,
          questionId,
          difficulty: question.difficulty!,
          modeTakenIn: session.mode,
          answeredCorrectly: isCorrect,
        },
        update: {
          answeredCorrectly: isCorrect,
          answeredAt: new Date(),
          modeTakenIn: session.mode,
        },
      }),
    ]);

    // Performance summary (Overall + the specific difficulty bucket) is kept
    // current here so the dashboard/ranking reflect this answer immediately.
    // Rank itself is NOT recomputed per-answer (that stays a scheduled job,
    // per §8.1) — only the running average/count that rank is later derived from.
    if (question.difficulty) {
      await ranking.updateSummaryAfterAnswer(session.userId, question.difficulty, isCorrect);
    }

    return { isCorrect };
  }

  async completeSession(sessionId: string) {
    return prisma.quizSession.update({
      where: { id: sessionId },
      data: { status: SessionStatus.COMPLETED, completedAt: new Date() },
    });
  }

  /**
   * Fetches a session with its questions for the quiz-taking UI. Deliberately
   * omits `correctOption` from unanswered questions so the client can't read
   * the answer out of the network payload before submitting — it's only
   * revealed (via submitAnswer's response) once the student actually answers.
   */
  async getSessionForStudent(sessionId: string) {
    const session = await prisma.quizSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        questions: {
          orderBy: { sequenceNumber: 'asc' },
          include: { question: true },
        },
      },
    });

    return {
      id: session.id,
      mode: session.mode,
      status: session.status,
      totalQuestions: session.totalQuestions,
      questions: session.questions.map((sq) => ({
        sequenceNumber: sq.sequenceNumber,
        questionId: sq.questionId,
        answered: sq.answered,
        selectedOption: sq.selectedOption,
        isCorrect: sq.isCorrect,
        questionText: sq.question.questionText,
        optionA: sq.question.optionA,
        optionB: sq.question.optionB,
        optionC: sq.question.optionC,
        optionD: sq.question.optionD,
        difficulty: sq.question.difficulty,
        category: sq.question.category,
        // correctOption intentionally omitted until answered=true
        correctOption: sq.answered ? sq.question.correctOption : null,
      })),
    };
  }

  /** Score summary shown on the results screen after completion. */
  async getSessionResults(sessionId: string) {
    const session = await prisma.quizSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { questions: true },
    });

    const answered = session.questions.filter((q) => q.answered);
    const correct = answered.filter((q) => q.isCorrect).length;

    return {
      sessionId: session.id,
      mode: session.mode,
      totalQuestions: session.totalQuestions,
      answeredCount: answered.length,
      correctCount: correct,
      accuracyPercent: answered.length > 0 ? (correct / answered.length) * 100 : 0,
    };
  }

  /**
   * Scheduled job (e.g. every 15 min via cron) — marks stale sessions abandoned,
   * releases their unanswered questions back to the pool (no action needed beyond
   * status change, since allocation always queries live PUBLISHED questions), and
   * explicitly does NOT refund quota (§4.3 / §5).
   */
  async sweepAbandonedSessions() {
    const settings = await prisma.platformSettings.findUniqueOrThrow({
      where: { id: 'singleton' },
    });
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - settings.sessionInactivityHours);

    const stale = await prisma.quizSession.findMany({
      where: { status: SessionStatus.IN_PROGRESS, lastActivityAt: { lt: cutoff } },
    });

    for (const s of stale) {
      await prisma.quizSession.update({
        where: { id: s.id },
        data: { status: SessionStatus.ABANDONED },
      });
      await quota.onSessionAbandoned(s.id); // no-op by design — documents the rule
    }

    return { abandonedCount: stale.length };
  }
}
