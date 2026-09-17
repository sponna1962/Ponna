// Live Exam / Mock Exam — student-facing engine.
//
// Sept 2026: Live Exam is a WEEKLY exam, not a Saturday/Sunday-only exam.
// Students can start it any day from Monday 00:00 IST through Sunday
// 23:59:59 IST, with one attempt per exam per week. Results are released
// together at the next Monday 00:00 IST.
//
// Question selection is now syllabus-blueprint driven. The configured
// question count is distributed as evenly as possible across the official
// SyllabusSubject rows already stored for that exam. Each subject must have
// enough valid questions before an attempt can start. Questions used by any
// previous Live Exam for the same exam are permanently excluded from future
// papers (as long as the historical attempt records remain in the database).
//
// The existing SyllabusSubject/SyllabusTopic hierarchy is the source of
// truth. At present, Question.subjectId is the reliable content mapping;
// topic-level tagging is not yet complete for the existing bank, so this
// release enforces the syllabus at SUBJECT level rather than inventing topic
// weights. Once topic tagging is complete, the same blueprint can be made
// topic-exact without changing the student-facing exam flow.

import { CorrectOption, MockExamAttemptStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { scopeAccessService, ScopeRestrictedError } from '../quota/scope-access.service';
import { PracticePreferenceService } from '../practice-preference/practice-preference.service';

export class MockExamError extends Error {}

const preferenceService = new PracticePreferenceService();

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function istDateLabel(now: Date): Date {
  const nowIst = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()));
}

function istLabelToRealInstant(label: Date): Date {
  return new Date(label.getTime() - IST_OFFSET_MS);
}

/** Monday IST-date LABEL identifying the current weekly Live Exam cycle. */
export function getCurrentExamWeekStart(now: Date = new Date()): Date {
  const todayLabel = istDateLabel(now);
  const dayOfWeek = new Date(now.getTime() + IST_OFFSET_MS).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return new Date(todayLabel.getTime() - daysSinceMonday * DAY_MS);
}

/** Results for a weekly exam become visible at the following Monday 00:00 IST. */
export function getResultsReleaseAt(weekStart: Date): Date {
  return istLabelToRealInstant(new Date(weekStart.getTime() + 7 * DAY_MS));
}

/** Monday IST-date LABEL of the next weekly cycle. */
export function getNextExamWeekStart(now: Date = new Date()): Date {
  return new Date(getCurrentExamWeekStart(now).getTime() + 7 * DAY_MS);
}

function normalizeName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Distribute N questions as evenly as possible across the supplied syllabus
 * subjects. The first slots receive the remainder so the sum is EXACTLY N.
 */
function allocateEvenly(ids: string[], total: number): Map<string, number> {
  const result = new Map<string, number>();
  if (ids.length === 0) return result;
  const base = Math.floor(total / ids.length);
  let remainder = total % ids.length;
  for (const id of ids) {
    const count = base + (remainder > 0 ? 1 : 0);
    result.set(id, count);
    if (remainder > 0) remainder--;
  }
  return result;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
      if (q.selectedOption === null) continue;
      if (q.isCorrect) score += config.marksPerQuestion;
      else score -= config.marksPerQuestion * config.negativeMarkingFraction;
    }

    await prisma.mockExamAttempt.update({
      where: { id: attemptId },
      data: { status, completedAt: new Date(), score },
    });
  }

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

      if (user.isTestAccount) return { access: 'READY' as const, config };

      const releaseAt = getResultsReleaseAt(fresh.weekStart);
      if (now < releaseAt) {
        return { access: 'AWAITING_RESULTS' as const, attemptId: fresh.id, resultsReleaseAt: releaseAt };
      }

      const isThisWeeksAttempt = fresh.weekStart.getTime() === currentWeekStart.getTime();
      if (!isThisWeeksAttempt) return { access: 'READY' as const, config };

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

  /**
   * Build the weekly paper from the syllabus already stored for this exam.
   *
   * IMPORTANT: we do not silently fall back to random questions when a
   * syllabus subject is under-filled. A paper that violates the syllabus
   * blueprint is rejected instead, so the admin knows the content pool must
   * be completed/classified first.
   */
  private async buildSyllabusBlueprintPaper(
    subCategoryId: string,
    language: 'TA' | 'EN',
    questionCount: number,
  ) {
    const syllabusSubjects = await prisma.syllabusSubject.findMany({
      where: { subCategoryId },
      include: { topics: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    if (syllabusSubjects.length === 0) {
      throw new MockExamError('Live Exam cannot start because the official syllabus has no Subjects configured for this exam.');
    }

    // Question.subjectId belongs to the existing Question-bank Subject model;
    // the syllabus master intentionally has a separate SyllabusSubject model.
    // Match them by the exact human-approved subject name rather than guessing
    // by ID. This is the reliable subject-level bridge used by the current bank.
    const questionSubjects = await prisma.subject.findMany({
      where: { subCategoryId },
      select: { id: true, name: true },
    });
    const questionSubjectByName = new Map(questionSubjects.map((s) => [normalizeName(s.name), s]));

    const mapped = syllabusSubjects.map((s) => ({
      syllabus: s,
      questionSubject: questionSubjectByName.get(normalizeName(s.name)),
    }));
    const unmapped = mapped.filter((m) => !m.questionSubject);
    if (unmapped.length > 0) {
      throw new MockExamError(
        `Live Exam syllabus mapping is incomplete. No Question-bank Subject exists for: ${unmapped.map((m) => m.syllabus.name).join(', ')}. Classify/map these subjects before publishing the exam.`,
      );
    }

    const counts = allocateEvenly(mapped.map((m) => m.questionSubject!.id), questionCount);

    // Never reuse a question that appeared in an earlier Live Exam for this
    // exam. This is intentionally independent of normal Practice history.
    const previous = await prisma.mockExamQuestion.findMany({
      where: { attempt: { subCategoryId } },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    const excludedIds = previous.map((p) => p.questionId);

    const selected: { id: string }[] = [];
    const shortages: string[] = [];

    for (const item of mapped) {
      const subjectId = item.questionSubject!.id;
      const needed = counts.get(subjectId) ?? 0;
      if (needed === 0) continue;

      const pool = await prisma.question.findMany({
        where: {
          id: { notIn: excludedIds },
          status: 'PUBLISHED',
          auditFlags: { none: { status: { not: 'DISMISSED' } } },
          language,
          subjectId,
          OR: [{ subCategoryId }, { authorityTags: { some: { subCategoryId } } }],
        },
        select: { id: true },
      });

      if (pool.length < needed) {
        shortages.push(`${item.syllabus.name}: ${pool.length}/${needed}`);
        continue;
      }

      selected.push(...shuffle(pool).slice(0, needed));
    }

    if (shortages.length > 0) {
      throw new MockExamError(
        `Live Exam blueprint cannot be completed. Not enough new valid questions in: ${shortages.join('; ')}. Add/classify questions before students can start this week's exam.`,
      );
    }

    if (selected.length !== questionCount) {
      throw new MockExamError(`Live Exam blueprint produced ${selected.length}/${questionCount} questions. Exam not started.`);
    }

    return shuffle(selected);
  }

  async startAttempt(userId: string, subCategoryId: string) {
    if (!(await this.hasPaidAccess(userId))) throw new MockExamError('Live Exam requires an active Annual Plan.');
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

    const existing = await prisma.mockExamAttempt.findUnique({
      where: { userId_subCategoryId_weekStart: { userId, subCategoryId, weekStart } },
    });
    if (existing) {
      if (!user.isTestAccount) {
        throw new MockExamError('You have already attempted this exam this week. A new Live Exam opens next Monday.');
      }
      await prisma.mockExamQuestion.deleteMany({ where: { attemptId: existing.id } });
      await prisma.mockExamAttempt.delete({ where: { id: existing.id } });
    }

    const preference = await preferenceService.get(userId);
    if (!preference) {
      throw new MockExamError('Please complete Practice Setup first — Live Exam uses the same language preference.');
    }

    const questions = await this.buildSyllabusBlueprintPaper(
      subCategoryId,
      preference.language as 'TA' | 'EN',
      config.questionCount,
    );

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + config.durationMinutes * 60 * 1000);

    const attempt = await prisma.mockExamAttempt.create({
      data: {
        userId,
        subCategoryId,
        startedAt,
        expiresAt,
        weekStart,
        totalMarks: config.questionCount * config.marksPerQuestion,
        questions: {
          create: questions.map((q, i) => ({ questionId: q.id, sequenceNumber: i + 1 })),
        },
      },
    });

    return { attemptId: attempt.id, expiresAt: attempt.expiresAt };
  }

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

    return { saved: true };
  }

  async submitExam(userId: string, attemptId: string) {
    const attempt = await prisma.mockExamAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new MockExamError('Not your attempt.');
    if (attempt.status !== 'IN_PROGRESS') throw new MockExamError('This Live Exam has already ended.');

    await this.finalizeScore(attemptId, MockExamAttemptStatus.COMPLETED);
    return { submitted: true, resultsReleaseAt: getResultsReleaseAt(attempt.weekStart) };
  }
}
