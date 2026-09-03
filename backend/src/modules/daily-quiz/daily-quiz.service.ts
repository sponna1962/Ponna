// Daily Quiz (finalized requirement) — admin management + student flow.
// Deliberately its own service, its own tables, no imports from
// quota.service.ts, allocation.service.ts, or session.service.ts — this
// feature must remain completely separate from normal Practice.

import { CorrectOption, DailyQuizStatus, Language, SubscriptionStatus, DailyQuizAnswer } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { prisma } from '../../lib/prisma';

const IST_OFFSET_MINUTES = 5 * 60 + 30; // Asia/Kolkata is always UTC+5:30, no DST

/** Converts a "YYYY-MM-DD" date + "HH:MM" IST time into the correct UTC
 * instant — every publishAt/expiresAt calculation goes through this, so
 * IST is explicit everywhere rather than relying on the server's own
 * timezone (finalized requirement — this is exactly the class of bug
 * flagged earlier for the Free-quota daily reset). */
function istToUtc(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  // Treat the given date+time as IST wall-clock time, then subtract the
  // IST offset to get the equivalent UTC instant.
  const utcMillis = Date.UTC(y, mo - 1, d, h, m) - IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMillis);
}

/** The current instant's IST calendar date, as "YYYY-MM-DD" — used to
 * default the admin's Create form and to find "today's" quiz. */
function todayIstDateStr(): string {
  const nowIst = new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000);
  return nowIst.toISOString().slice(0, 10);
}

type ParsedRow = {
  questionTextTa: string;
  optionATa: string;
  optionBTa: string;
  optionCTa: string;
  optionDTa: string;
  questionTextEn: string;
  optionAEn: string;
  optionBEn: string;
  optionCEn: string;
  optionDEn: string;
  correctOption: CorrectOption;
  explanationTa: string;
  explanationEn: string;
};

export class DailyQuizError extends Error {}

export class DailyQuizService {
  // ── Admin: CSV parsing + validation (preview only, writes nothing) ──

  /** Parses and validates the CSV — returns the 10 rows plus any errors.
   * Never writes to the database; the admin reviews this preview, then
   * calls createDailyQuiz() explicitly to actually publish/schedule it. */
  parseAndValidateCsv(csvText: string): { rows: ParsedRow[]; errors: string[] } {
    const errors: string[] = [];
    let records: Record<string, string>[];
    try {
      records = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
    } catch (err: any) {
      return { rows: [], errors: [`Could not parse CSV: ${err.message}`] };
    }

    if (records.length !== 10) {
      errors.push(`Expected exactly 10 questions, found ${records.length}.`);
    }

    const rows: ParsedRow[] = [];
    records.forEach((r, i) => {
      const rowNum = i + 1;
      const required = [
        'Tamil Question',
        'TA Option A',
        'TA Option B',
        'TA Option C',
        'TA Option D',
        'English Question',
        'EN Option A',
        'EN Option B',
        'EN Option C',
        'EN Option D',
        'Correct Option',
        'TA Explanation',
        'EN Explanation',
      ];
      for (const col of required) {
        if (!r[col]?.trim()) errors.push(`Row ${rowNum}: "${col}" is empty — every field is required, including both explanations.`);
      }
      const correct = r['Correct Option']?.trim().toUpperCase();
      if (correct && !['A', 'B', 'C', 'D'].includes(correct)) {
        errors.push(`Row ${rowNum}: "Correct Option" must be A, B, C, or D — got "${r['Correct Option']}".`);
      }

      rows.push({
        questionTextTa: r['Tamil Question']?.trim() ?? '',
        optionATa: r['TA Option A']?.trim() ?? '',
        optionBTa: r['TA Option B']?.trim() ?? '',
        optionCTa: r['TA Option C']?.trim() ?? '',
        optionDTa: r['TA Option D']?.trim() ?? '',
        questionTextEn: r['English Question']?.trim() ?? '',
        optionAEn: r['EN Option A']?.trim() ?? '',
        optionBEn: r['EN Option B']?.trim() ?? '',
        optionCEn: r['EN Option C']?.trim() ?? '',
        optionDEn: r['EN Option D']?.trim() ?? '',
        correctOption: (correct as CorrectOption) ?? 'A',
        explanationTa: r['TA Explanation']?.trim() ?? '',
        explanationEn: r['EN Explanation']?.trim() ?? '',
      });
    });

    return { rows, errors };
  }

  // ── Admin: create + schedule ──────────────────────────────────────────

  async createDailyQuiz(quizDateStr: string, publishTimeIst: string, rows: ParsedRow[]) {
    const { errors } = this.parseAndValidateCsv(this.rowsToCsvForRevalidation(rows));
    if (errors.length > 0) throw new DailyQuizError(`Cannot create — validation failed: ${errors.join(' ')}`);

    const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate: new Date(quizDateStr) } });
    if (existing) throw new DailyQuizError(`A Daily Quiz already exists for ${quizDateStr}. Delete it first or edit the schedule instead.`);

    const publishAt = istToUtc(quizDateStr, publishTimeIst);
    const expiresAt = new Date(publishAt.getTime() + 24 * 60 * 60 * 1000);

    return prisma.dailyQuiz.create({
      data: {
        quizDate: new Date(quizDateStr),
        publishAt,
        expiresAt,
        status: DailyQuizStatus.SCHEDULED,
        questions: {
          create: rows.map((row, i) => ({ sequenceNumber: i + 1, ...row })),
        },
      },
      include: { questions: true },
    });
  }

  /** Re-serializes parsed rows back through the same validator — a small
   * safety net so createDailyQuiz() can't be called with rows that never
   * actually passed validation (e.g. a bypassed frontend call). */
  private rowsToCsvForRevalidation(rows: ParsedRow[]): string {
    const header =
      'Tamil Question,TA Option A,TA Option B,TA Option C,TA Option D,English Question,EN Option A,EN Option B,EN Option C,EN Option D,Correct Option,TA Explanation,EN Explanation';
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [r.questionTextTa, r.optionATa, r.optionBTa, r.optionCTa, r.optionDTa, r.questionTextEn, r.optionAEn, r.optionBEn, r.optionCEn, r.optionDEn, r.correctOption, r.explanationTa, r.explanationEn]
        .map(esc)
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  async listDailyQuizzes() {
    return prisma.dailyQuiz.findMany({ orderBy: { quizDate: 'desc' }, include: { questions: false, _count: { select: { attempts: true } } } });
  }

  async getDailyQuizForAdmin(id: string) {
    return prisma.dailyQuiz.findUniqueOrThrow({ where: { id }, include: { questions: { orderBy: { sequenceNumber: 'asc' } } } });
  }

  async updateSchedule(id: string, publishTimeIst: string) {
    const quiz = await prisma.dailyQuiz.findUniqueOrThrow({ where: { id } });
    const quizDateStr = quiz.quizDate.toISOString().slice(0, 10);
    const publishAt = istToUtc(quizDateStr, publishTimeIst);
    const expiresAt = new Date(publishAt.getTime() + 24 * 60 * 60 * 1000);
    return prisma.dailyQuiz.update({ where: { id }, data: { publishAt, expiresAt } });
  }

  async deleteDailyQuiz(id: string) {
    await prisma.dailyQuizAnswer.deleteMany({ where: { attempt: { dailyQuizId: id } } });
    await prisma.dailyQuizAttempt.deleteMany({ where: { dailyQuizId: id } });
    await prisma.dailyQuizQuestion.deleteMany({ where: { dailyQuizId: id } });
    await prisma.dailyQuiz.delete({ where: { id } });
  }

  // ── Scheduled sweep (display/admin convenience only — see note on
  // DailyQuiz.status; the student-facing methods below never trust this) ──

  async runStatusSweep() {
    const now = new Date();
    const publishedCount = await prisma.dailyQuiz.updateMany({
      where: { status: DailyQuizStatus.SCHEDULED, publishAt: { lte: now } },
      data: { status: DailyQuizStatus.PUBLISHED },
    });
    const expiredCount = await prisma.dailyQuiz.updateMany({
      where: { status: DailyQuizStatus.PUBLISHED, expiresAt: { lte: now } },
      data: { status: DailyQuizStatus.EXPIRED },
    });
    return { published: publishedCount.count, expired: expiredCount.count };
  }

  // ── Student: access + attempt flow ────────────────────────────────────

  /** Daily Quiz access is a simple binary gate — ANY active paid
   * Subscription (regardless of which exam it scopes to), since this is
   * exam-agnostic current-affairs content, not tied to a specific exam's
   * Plan scope. */
  private async hasPaidAccess(userId: string): Promise<boolean> {
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, cycleEnd: { gt: new Date() }, plan: { isFree: false } },
    });
    return !!activeSub;
  }

  /** Finds a live-right-now quiz by re-checking publishAt/expiresAt
   * directly against the current instant (finalized requirement —
   * cron-safety: never trusts the `status` field alone). Returns null if
   * none — including the "admin never scheduled today's quiz" case AND
   * the "yesterday's already expired" case, both correctly, since the
   * live check excludes both. */
  private async findLiveQuiz() {
    const now = new Date();
    return prisma.dailyQuiz.findFirst({
      where: { publishAt: { lte: now }, expiresAt: { gt: now } },
      include: { questions: { orderBy: { sequenceNumber: 'asc' } } },
    });
  }

  /** Top-level student entry point — returns exactly what the frontend
   * needs to decide what to show: access gate, "not available yet", or
   * the quiz itself (with any existing attempt's progress). */
  async getStudentState(userId: string) {
    if (!(await this.hasPaidAccess(userId))) {
      return { access: 'FREE_LOCKED' as const };
    }

    const quiz = await this.findLiveQuiz();
    if (!quiz) {
      return { access: 'NOT_AVAILABLE' as const };
    }

    const attempt = await prisma.dailyQuizAttempt.findUnique({
      where: { userId_dailyQuizId: { userId, dailyQuizId: quiz.id } },
      include: { answers: true },
    });

    return {
      access: 'AVAILABLE' as const,
      quizId: quiz.id,
      expiresAt: quiz.expiresAt,
      totalQuestions: quiz.questions.length,
      attempt: attempt
        ? {
            language: attempt.language,
            completedAt: attempt.completedAt,
            score: attempt.score,
            answeredQuestionIds: attempt.answers.map((a) => a.questionId),
          }
        : null,
    };
  }

  /** Starts a NEW attempt (language chosen here, locked forever after) —
   * or, if one already exists for this quiz, just returns it unchanged
   * (finalized requirement — resuming never lets the language be
   * switched). Re-verifies the quiz is still live at this exact moment,
   * even if the student's client had it cached from a moment ago
   * (finalized requirement — no longer resumable after expiry). */
  async startOrResumeAttempt(userId: string, dailyQuizId: string, language: Language) {
    if (!(await this.hasPaidAccess(userId))) throw new DailyQuizError('Daily Quiz requires an active Annual Plan.');

    const quiz = await prisma.dailyQuiz.findUniqueOrThrow({ where: { id: dailyQuizId } });
    const now = new Date();
    if (now < quiz.publishAt || now >= quiz.expiresAt) {
      throw new DailyQuizError("Today's Daily Quiz is not available right now.");
    }

    const existing = await prisma.dailyQuizAttempt.findUnique({ where: { userId_dailyQuizId: { userId, dailyQuizId } } });
    if (existing) return existing; // language param ignored — already locked

    return prisma.dailyQuizAttempt.create({ data: { userId, dailyQuizId, language } });
  }

  /** Records one answer — rejects if the quiz has since expired (even
   * mid-attempt), if this question was already answered (idempotent
   * resume — never re-presents an answered question), or if the attempt
   * doesn't belong to this student. */
  async submitAnswer(userId: string, attemptId: string, questionId: string, selectedOption: CorrectOption) {
    const attempt = await prisma.dailyQuizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { dailyQuiz: true },
    });
    if (attempt.userId !== userId) throw new DailyQuizError('Not your attempt.');
    if (attempt.completedAt) throw new DailyQuizError('This attempt is already complete.');

    const now = new Date();
    if (now >= attempt.dailyQuiz.expiresAt) {
      throw new DailyQuizError("Today's Daily Quiz has expired — this attempt can no longer be continued.");
    }

    const question = await prisma.dailyQuizQuestion.findUniqueOrThrow({ where: { id: questionId } });
    if (question.dailyQuizId !== attempt.dailyQuizId) throw new DailyQuizError('Question does not belong to this quiz.');

    const alreadyAnswered = await prisma.dailyQuizAnswer.findUnique({ where: { attemptId_questionId: { attemptId, questionId } } });
    if (alreadyAnswered) return alreadyAnswered; // idempotent — resuming never re-asks an answered question

    const isCorrect = selectedOption === question.correctOption;
    return prisma.dailyQuizAnswer.create({ data: { attemptId, questionId, selectedOption, isCorrect } });
  }

  async completeAttempt(userId: string, attemptId: string) {
    const attempt = await prisma.dailyQuizAttempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: true } });
    if (attempt.userId !== userId) throw new DailyQuizError('Not your attempt.');

    const score = attempt.answers.filter((a) => a.isCorrect).length;
    return prisma.dailyQuizAttempt.update({ where: { id: attemptId }, data: { completedAt: new Date(), score } });
  }

  /**
   * The actual question content for an in-progress attempt, in the
   * attempt's locked language. Unanswered questions never expose
   * correctOption/explanation (same principle as normal Practice); an
   * already-answered question (resume case) includes the student's
   * recorded selectedOption + isCorrect + correctOption + explanation,
   * since that's exactly what "immediate result" already revealed to
   * them the first time — resuming just re-shows it, never re-asks.
   */
  async getAttemptQuestions(userId: string, attemptId: string) {
    const attempt = await prisma.dailyQuizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: {
        answers: true,
        dailyQuiz: { include: { questions: { orderBy: { sequenceNumber: 'asc' } } } },
      },
    });
    if (attempt.userId !== userId) throw new DailyQuizError('Not your attempt.');

    const answersByQuestionId = new Map<string, DailyQuizAnswer>(attempt.answers.map((a) => [a.questionId, a]));
    const isTa = attempt.language === 'TA';

    return {
      attemptId: attempt.id,
      language: attempt.language,
      completedAt: attempt.completedAt,
      score: attempt.score,
      questions: attempt.dailyQuiz.questions.map((q) => {
        const answer = answersByQuestionId.get(q.id);
        return {
          id: q.id,
          sequenceNumber: q.sequenceNumber,
          questionText: isTa ? q.questionTextTa : q.questionTextEn,
          optionA: isTa ? q.optionATa : q.optionAEn,
          optionB: isTa ? q.optionBTa : q.optionBEn,
          optionC: isTa ? q.optionCTa : q.optionCEn,
          optionD: isTa ? q.optionDTa : q.optionDEn,
          answered: !!answer,
          selectedOption: answer?.selectedOption ?? null,
          isCorrect: answer?.isCorrect ?? null,
          // Only revealed once answered — same principle as normal Practice.
          correctOption: answer ? q.correctOption : null,
          explanation: answer ? (isTa ? q.explanationTa : q.explanationEn) : null,
        };
      }),
    };
  }
}
