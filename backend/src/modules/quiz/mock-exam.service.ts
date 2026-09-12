// Live Exam / Mock Exam — student-facing engine (finalized requirement,
// ₹999 Annual Plan value-add, item 2 of 3). A genuine timed simulation:
// answers are NEVER revealed until the attempt is completed (unlike
// Daily Quiz/normal Practice) so it actually feels like the real exam.
// Full syllabus coverage -- no Subject Preference weighting, no
// difficulty filtering by mode -- exactly like the real exam draws from
// the whole syllabus. Completely separate from normal Practice: no
// quota, no UserQuestionHistory, no effect on ranking or no-repeat.
//
// Sept 2026 (BINDING) — Weekly cycle: the exam only OPENS Saturday
// 00:00 IST through Sunday 23:59:59 IST each week (student's choice of
// either day, one attempt per exam per weekend). Results are withheld
// from EVERYONE until Monday 00:00 IST of that same weekend, regardless
// of when within the window a student finished — so no student who
// finishes early sees their score (or can infer anything from it)
// before anyone else. A missed weekend is simply lost -- no catch-up,
// matching how a real exam works.

import { CorrectOption, MockExamAttemptStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { scopeAccessService, ScopeRestrictedError } from '../quota/scope-access.service';
import { PracticePreferenceService } from '../practice-preference/practice-preference.service';

export class MockExamError extends Error {}

const preferenceService = new PracticePreferenceService();

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** IST calendar-date LABEL for `now` — a UTC-midnight Date standing in
 * for that IST calendar date, same convention as streak.service.ts's
 * todayIstAsDate(). Day-arithmetic (+/- N days) on this label is exact
 * and DST-free since India has no DST. */
function istDateLabel(now: Date): Date {
  const nowIst = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()));
}

/** The reverse of istDateLabel: the real UTC instant that "00:00 IST on
 * this labeled date" actually occurs at. */
function istLabelToRealInstant(label: Date): Date {
  return new Date(label.getTime() - IST_OFFSET_MS);
}

/** Returns the Saturday IST-date LABEL identifying the CURRENT weekend
 * cycle if `now` falls within the Sat 00:00 IST – Sun 23:59:59.999 IST
 * window, or null if the window is currently closed (a weekday). */
export function getCurrentExamWeekStart(now: Date = new Date()): Date | null {
  const todayLabel = istDateLabel(now);
  const dayOfWeek = new Date(now.getTime() + IST_OFFSET_MS).getUTCDay(); // 0=Sun..6=Sat, on the IST-shifted instant
  if (dayOfWeek === 6) return todayLabel; // it IS Saturday
  if (dayOfWeek === 0) return new Date(todayLabel.getTime() - DAY_MS); // Sunday -> the weekend's Saturday was yesterday
  return null; // weekday — window closed
}

/** The real UTC instant results for a given weekStart become visible at
 * — Monday 00:00 IST of that same weekend (weekStart + 2 days). */
export function getResultsReleaseAt(weekStart: Date): Date {
  const mondayLabel = new Date(weekStart.getTime() + 2 * DAY_MS);
  return istLabelToRealInstant(mondayLabel);
}

/** The Saturday IST-date LABEL of the NEXT upcoming weekend window, for
 * a "next opens on <date>" hint when the window is currently closed. */
export function getNextExamWeekStart(now: Date = new Date()): Date {
  const todayLabel = istDateLabel(now);
  const dayOfWeek = new Date(now.getTime() + IST_OFFSET_MS).getUTCDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7; // if today IS Saturday, "next" is 7 days away, not 0
  return new Date(todayLabel.getTime() + daysUntilSaturday * DAY_MS);
}

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

  /** Sept 2026 (student-requested) — every exam that actually has Live
   * Exam configured, so students pick directly rather than navigating
   * the full taxonomy tree to find out which ones even have it. */
  async listAvailableExams(): Promise<{ subCategoryId: string; name: string; authorityName: string; categoryName: string }[]> {
    const configs = await prisma.mockExamConfig.findMany({
      include: { subCategory: { include: { category: { include: { authority: true } } } } },
    });
    return configs
      .filter((c) => c.subCategory.studentVisible)
      .map((c) => ({
        subCategoryId: c.subCategoryId,
        name: c.subCategory.name,
        authorityName: c.subCategory.category.authority.name,
        categoryName: c.subCategory.category.name,
      }));
  }

  async getState(userId: string, subCategoryId: string) {
    if (!(await this.hasPaidAccess(userId))) return { access: 'FREE_LOCKED' as const };
    // Sept 2026 — TNPSC Group IV & VAO Pass restriction (BINDING).
    try {
      await scopeAccessService.assertSubCategoryAllowed(userId, subCategoryId);
    } catch (e) {
      if (e instanceof ScopeRestrictedError) return { access: 'FREE_LOCKED' as const };
      throw e;
    }

    const config = await prisma.mockExamConfig.findUnique({ where: { subCategoryId } });
    if (!config) return { access: 'NOT_CONFIGURED' as const };

    const now = new Date();
    const currentWeekStart = getCurrentExamWeekStart(now);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isTestAccount: true } });

    const latest = await prisma.mockExamAttempt.findFirst({
      where: { userId, subCategoryId },
      orderBy: { startedAt: 'desc' },
    });

    if (latest) {
      await this.expireIfNeeded(latest.id);
      const fresh = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: latest.id } });

      if (fresh.status === 'IN_PROGRESS') {
        return { access: 'IN_PROGRESS' as const, attemptId: fresh.id, expiresAt: fresh.expiresAt, config };
      }

      // Sept 2026 — Test Accounts skip the weekend-cycle/results-withholding
      // gating entirely (retry as many times as needed for QA); a real
      // student's actual weekly cycle behavior below is completely
      // unaffected by this.
      if (user.isTestAccount) {
        return { access: 'READY' as const, config };
      }

      // Completed or Expired — withheld until Monday 00:00 IST of ITS OWN weekend cycle.
      const releaseAt = getResultsReleaseAt(fresh.weekStart);
      if (now < releaseAt) {
        return { access: 'AWAITING_RESULTS' as const, attemptId: fresh.id, resultsReleaseAt: releaseAt };
      }

      // Results are out. If we're now inside a LATER open window than the
      // one this attempt belongs to, let the student start fresh for the
      // new weekend instead of showing last cycle's result forever.
      const isThisWeeksAttempt = currentWeekStart !== null && fresh.weekStart.getTime() === currentWeekStart.getTime();
      if (currentWeekStart !== null && !isThisWeeksAttempt) {
        return { access: 'READY' as const, config };
      }

      return {
        access: 'COMPLETED' as const,
        attemptId: fresh.id,
        score: fresh.score,
        totalMarks: fresh.totalMarks,
        wasExpired: fresh.status === 'EXPIRED',
      };
    }

    if (currentWeekStart === null && !user.isTestAccount) {
      return { access: 'WINDOW_CLOSED' as const, nextOpensAt: istLabelToRealInstant(getNextExamWeekStart(now)) };
    }
    return { access: 'READY' as const, config };
  }

  async startAttempt(userId: string, subCategoryId: string) {
    if (!(await this.hasPaidAccess(userId))) throw new MockExamError('Live Exam requires an active Annual Plan.');
    // Sept 2026 — TNPSC Group IV & VAO Pass restriction (BINDING) — blocks
    // even a direct API request for another exam's Live Exam.
    try {
      await scopeAccessService.assertSubCategoryAllowed(userId, subCategoryId);
    } catch (e) {
      if (e instanceof ScopeRestrictedError) throw new MockExamError(e.message);
      throw e;
    }

    const config = await prisma.mockExamConfig.findUnique({ where: { subCategoryId } });
    if (!config) throw new MockExamError('Live Exam is not configured for this exam yet.');

    const weekStart = getCurrentExamWeekStart();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { isTestAccount: true } });

    if (weekStart === null && !user.isTestAccount) {
      throw new MockExamError('Live Exam is open only on Saturdays and Sundays (IST). Come back this weekend.');
    }
    // Sept 2026 — Test Accounts (isTestAccount=true) bypass BOTH the
    // weekday window and the one-attempt-per-weekend restriction, so QA
    // can retry the same exam repeatedly without waiting for a real
    // weekend. Falls back to today's IST date as a synthetic weekStart
    // on a weekday, purely so the attempt record still has a value for
    // that (required) column -- never used for any real student.
    const effectiveWeekStart = weekStart ?? istDateLabel(new Date());

    const existing = await prisma.mockExamAttempt.findUnique({
      where: { userId_subCategoryId_weekStart: { userId, subCategoryId, weekStart: effectiveWeekStart } },
    });
    if (existing) {
      if (!user.isTestAccount) {
        throw new MockExamError('You have already attempted this exam this weekend — one attempt per weekend, like the real exam.');
      }
      // Test Account retry: clear the prior attempt for this exact
      // weekStart so a fresh one can be created below.
      await prisma.mockExamQuestion.deleteMany({ where: { attemptId: existing.id } });
      await prisma.mockExamAttempt.delete({ where: { id: existing.id } });
    }

    // Sept 2026 (BUG FIX) — Live Exam previously had NO language filter
    // at all, mixing Tamil and English questions together regardless of
    // the student's own preference. Uses the SAME saved Practice
    // Preference language every other part of the app already respects
    // — no separate language step needed here, matching how Live Exam
    // otherwise reuses the student's existing setup (Sub-Category access,
    // paid plan) rather than asking again.
    const preference = await preferenceService.get(userId);
    if (!preference) {
      throw new MockExamError('Please complete Practice Setup first — Live Exam uses the same language preference.');
    }

    const questions = await prisma.question.findMany({
      where: {
        status: 'PUBLISHED',
        language: preference.language,
        // Sept 2026 (BUG FIX) — was authorityTags-only, missing the
        // DIRECT subCategoryId a question is normally tagged with (the
        // primary tag every Bulk Upload/Question edit sets). authorityTags
        // (QuestionTaxonomyTag) is for ADDITIONAL tags on top of that —
        // e.g. Cross-Exam Question Tagging — never the only path. Same
        // OR pattern practice-preference.service.ts's own
        // resolveTaxonomyFilter() already uses everywhere else; Live
        // Exam had fallen out of sync with it.
        OR: [{ subCategoryId }, { authorityTags: { some: { subCategoryId } } }],
      },
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
        weekStart: effectiveWeekStart,
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
   * right as you go. Only once completed AND results have been released
   * (Monday 00:00 IST) does this reveal everything. */
  async getQuestions(userId: string, attemptId: string) {
    await this.expireIfNeeded(attemptId);
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { questions: { orderBy: { sequenceNumber: 'asc' }, include: { question: true } } },
    });
    if (attempt.userId !== userId) throw new MockExamError('Not your attempt.');

    const resultsReleased = attempt.status !== 'IN_PROGRESS' && new Date() >= getResultsReleaseAt(attempt.weekStart);

    return {
      status: attempt.status,
      expiresAt: attempt.expiresAt,
      resultsReleaseAt: getResultsReleaseAt(attempt.weekStart),
      questions: attempt.questions.map((mq) => ({
        id: mq.questionId,
        sequenceNumber: mq.sequenceNumber,
        questionText: mq.question.questionText,
        optionA: mq.question.optionA,
        optionB: mq.question.optionB,
        optionC: mq.question.optionC,
        optionD: mq.question.optionD,
        selectedOption: mq.selectedOption,
        // Only revealed once the attempt is completed AND Monday 00:00 IST
        // has passed for its weekend — never mid-exam, never early.
        correctOption: resultsReleased ? mq.question.correctOption : null,
        explanation: resultsReleased ? (mq.question.language === 'TA' ? mq.question.explanationTa : mq.question.explanationEn) : null,
      })),
    };
  }

  async submitAnswer(userId: string, attemptId: string, questionId: string, selectedOption: CorrectOption, timeSpentSeconds?: number) {
    await this.expireIfNeeded(attemptId);
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new MockExamError('Not your attempt.');
    if (attempt.status !== 'IN_PROGRESS') throw new MockExamError('This Live Exam has ended.');

    const mockQuestion = await prisma.mockExamQuestion.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId, questionId } } });
    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.mockExamQuestion.update({
      where: { id: mockQuestion.id },
      data: { selectedOption, isCorrect, answeredAt: new Date(), timeSpentSeconds },
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
    // Deliberately does NOT return score/totalMarks here anymore -- Sept
    // 2026 (BINDING): results are withheld until Monday 00:00 IST for
    // EVERY student who attempted this weekend, regardless of when they
    // personally finished. The student sees "submitted" + the release time.
    return { submitted: true, resultsReleaseAt: getResultsReleaseAt(attempt.weekStart) };
  }
}
