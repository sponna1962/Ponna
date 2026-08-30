// Quiz Session Engine — implements §4.3 (Taking a Quiz) session lifecycle:
// start (reserve quota + questions), resume, answer, complete, and the
// scheduled abandonment sweep.

import { PrismaClient, QuizMode, SessionStatus, CorrectOption } from '@prisma/client';
import { QuotaService, QuotaExceededError } from '../quota/quota.service';
import { AllocationService } from '../questions/allocation.service';
import { RankingService } from '../ranking/ranking.service';
import { PracticePreferenceService } from '../practice-preference/practice-preference.service';

const prisma = new PrismaClient();
const quota = new QuotaService();
const allocation = new AllocationService();
const ranking = new RankingService();
const preferenceService = new PracticePreferenceService();

export class SessionService {
  /**
   * Starts a new session, or returns the existing in-progress one if present.
   * No mode/language parameters anymore (finalized requirement) — every
   * session uses the student's saved Practice Preference (Language,
   * Authority/Category/Sub-Category, Difficulty), set up once via
   * /students/me/practice-preference and reused until they change it.
   * Throws if no preference has been saved yet — the frontend must not call
   * this before the student has completed (or already has) a preference.
   */
  async startSession(userId: string) {
    const preference = await preferenceService.get(userId);
    if (!preference) {
      throw new Error('No practice preference saved yet — complete Practice Setup first.');
    }
    const mode = preference.mode;

    const existing = await prisma.quizSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
      include: { questions: { orderBy: { sequenceNumber: 'asc' } } },
    });
    if (existing) {
      if (existing.questions.length === 0) {
        // A broken/empty session should never be resumed — it can only
        // ever show the "no questions" screen. Abandon it (no quota
        // refund — matches the language-mismatch case above) and fall
        // through to try building a fresh one for the current preference.
        await prisma.quizSession.update({ where: { id: existing.id }, data: { status: SessionStatus.ABANDONED } });
        await quota.onSessionAbandoned(existing.id);
      } else if (existing.practiceLanguage === preference.language) {
        // §4.3: same session resumes exactly where the student left off, no re-deduction
        return { ...existing, resumedWithDifferentSelection: false };
      } else {
        // The student changed their Practice Preference language since this
        // session was started (e.g. Tamil → English). Resuming it would show
        // the wrong language regardless of what they just picked — abandon it
        // (no quota refund, same rule as the inactivity sweep) and fall
        // through to build a fresh session for the current preference.
        await prisma.quizSession.update({ where: { id: existing.id }, data: { status: SessionStatus.ABANDONED } });
        await quota.onSessionAbandoned(existing.id); // no-op by design — documents the rule
      }
    }

    const remainingQuota = await quota.getRemainingQuota(userId);
    if (remainingQuota <= 0) {
      throw new QuotaExceededError(
        'You have used all your questions for today. Upgrade your plan to keep practicing, or come back tomorrow.',
      );
    }

    const taxonomyFilter = preferenceService.resolveTaxonomyFilter(preference.selections as any);

    // Build the eligible question list FIRST, before touching quota — same
    // reasoning as before: never reserve quota for questions that can't
    // actually be delivered. Cap the request at a generous ceiling (100) so
    // allocation doesn't need to know about quota at all; the real cap is
    // whichever is smaller of quota and eligible questions.
    const questionIds = await allocation.buildSessionQuestionIds(
      userId,
      mode,
      Math.min(remainingQuota, 100),
      preference.language,
      taxonomyFilter,
    );
    const actualSize = questionIds.length;

    if (actualSize === 0) {
      throw new Error(
        'No eligible questions match your Practice Preferences right now. Try widening your selections in Change Preferences.',
      );
    }

    const quotaResult = await quota.reserveQuota(userId, actualSize);
    if (!quotaResult.allowed) {
      throw new QuotaExceededError(quotaResult.reason ?? 'Quota exceeded');
    }

    const session = await prisma.quizSession.create({
      data: {
        userId,
        mode,
        practiceLanguage: preference.language,
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

    return { ...session, resumedWithDifferentSelection: false };
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

    return { isCorrect, correctOption: question.correctOption };
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
   *
   * Sends ONLY the language each question was actually allocated in
   * (`sq.question.language`) — never a linked translation's text, even when
   * one exists. Language is a one-time Practice Setup choice, not an
   * in-session toggle (finalized requirement); a previous version of this
   * method attached the linked translation "for future-proofing", but the
   * frontend's language fallback (`content.TA ?? content.EN`) unconditionally
   * preferred Tamil whenever both were present — so a student who chose
   * English still saw Tamil questions the moment a Tamil translation existed
   * for that question. Sending only the allocated language removes the
   * possibility of that mismatch entirely.
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
      questions: session.questions.map((sq) => {
        return {
          sequenceNumber: sq.sequenceNumber,
          questionId: sq.questionId,
          answered: sq.answered,
          selectedOption: sq.selectedOption,
          isCorrect: sq.isCorrect,
          difficulty: sq.question.difficulty,
          category: sq.question.category,
          // correctOption intentionally omitted until answered=true
          correctOption: sq.answered ? sq.question.correctOption : null,
          // Only ever the ONE language this question was allocated in — see
          // the method docstring for why the linked translation is
          // deliberately NOT included here.
          content: {
            [sq.question.language]: {
              questionText: sq.question.questionText,
              optionA: sq.question.optionA,
              optionB: sq.question.optionB,
              optionC: sq.question.optionC,
              optionD: sq.question.optionD,
            },
          },
        };
      }),
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
