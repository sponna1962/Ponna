// Signup-less "Test Your Ability" Diagnostic (Sept 2026, explicit
// request — Item 4). See schema.prisma's own header comment on
// GuestDiagnosticAttempt for the full design rationale: a brand-new
// visitor can start and complete this with NO signup at all; signup is
// required only to SEE the report, enforced server-side via
// migratedToUserId (not just hidden in the UI) -- claimAttempt() is the
// only thing that can set it, and getReport() refuses to return
// anything until it's set.

import { CorrectOption } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class GuestDiagnosticError extends Error {}

// Explicit requirement: at least 15 questions.
const MIN_DIAGNOSTIC_QUESTIONS = 15;

export class GuestDiagnosticService {
  /** Sept 2026 (real bug fix, confirmed from a live report) — was
   * returning an existing COMPLETED attempt as-is regardless of the
   * newly selected language, since "completed" was being treated as
   * "keep it, don't restart." That's wrong for the actual repeat-testing
   * scenario: a visitor who takes the diagnostic more than once before
   * ever signing up (e.g. tries Tamil, then comes back and picks
   * English) kept getting the SAME OLD attempt's questions in the SAME
   * OLD language every time, since "completed" was already true from
   * the first run.
   *
   * The only attempt that must genuinely never be discarded is one
   * that's already been CLAIMED by a real signed-up student
   * (migratedToUserId set) -- that's a permanent record of their actual
   * result. Anything unclaimed -- whether completed or still in
   * progress -- is discarded and a fresh attempt started in whichever
   * language was just selected, every time. */
  async startAttempt(guestId: string, subCategoryId: string, language: 'TA' | 'EN') {
    const existing = await prisma.guestDiagnosticAttempt.findUnique({ where: { guestId } });
    if (existing) {
      if (existing.migratedToUserId) return existing;
      await prisma.guestDiagnosticAnswer.deleteMany({ where: { attemptId: existing.id } });
      await prisma.guestDiagnosticAttempt.delete({ where: { id: existing.id } });
    }

    const questions = await prisma.question.findMany({
      where: {
        status: 'PUBLISHED',
        language,
        auditFlags: { none: { status: { not: 'DISMISSED' } } },
        OR: [{ subCategoryId }, { authorityTags: { some: { subCategoryId } } }],
      },
      take: MIN_DIAGNOSTIC_QUESTIONS,
      orderBy: { createdAt: 'asc' },
    });
    if (questions.length < MIN_DIAGNOSTIC_QUESTIONS) {
      throw new GuestDiagnosticError('Not enough published questions are available for this exam yet.');
    }

    return prisma.guestDiagnosticAttempt.create({
      data: {
        guestId,
        subCategoryId,
        answers: {
          create: questions.map((q, i) => ({ questionId: q.id, sequenceNumber: i + 1 })),
        },
      },
    });
  }

  /** Sept 2026 — lightweight status check for the Home page's auto-
   * redirect logic: does this device's guestId already have a genuinely
   * FINAL result -- i.e. claimed by a real signed-up student? (Not just
   * "completed" -- see startAttempt()'s own comment on why an unclaimed
   * completed attempt must still be freely restartable, e.g. to retry in
   * a different language before ever signing up.) If not claimed, the
   * Welcome Screen should show again on the next visit; startAttempt()
   * will discard whatever's there and start fresh. */
  async getStatus(guestId: string): Promise<{ completed: boolean }> {
    const attempt = await prisma.guestDiagnosticAttempt.findUnique({ where: { guestId }, select: { migratedToUserId: true } });
    return { completed: !!attempt?.migratedToUserId };
  }

  async getQuestions(guestId: string) {
    const attempt = await prisma.guestDiagnosticAttempt.findUniqueOrThrow({ where: { guestId } });
    const answers = await prisma.guestDiagnosticAnswer.findMany({
      where: { attemptId: attempt.id },
      orderBy: { sequenceNumber: 'asc' },
      include: { question: { select: { questionText: true, optionA: true, optionB: true, optionC: true, optionD: true } } },
    });
    return answers.map((a) => ({
      sequenceNumber: a.sequenceNumber,
      questionId: a.questionId,
      answered: !!a.answeredAt,
      selectedOption: a.selectedOption,
      questionText: a.question.questionText,
      optionA: a.question.optionA,
      optionB: a.question.optionB,
      optionC: a.question.optionC,
      optionD: a.question.optionD,
    }));
  }

  async submitAnswer(guestId: string, questionId: string, selectedOption: CorrectOption) {
    const attempt = await prisma.guestDiagnosticAttempt.findUniqueOrThrow({ where: { guestId } });
    const answer = await prisma.guestDiagnosticAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId: attempt.id, questionId } } });
    if (answer.answeredAt) return { isCorrect: answer.isCorrect ?? false };

    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.guestDiagnosticAnswer.update({
      where: { id: answer.id },
      data: { selectedOption, isCorrect, answeredAt: new Date() },
    });
    return { isCorrect };
  }

  async completeAttempt(guestId: string) {
    return prisma.guestDiagnosticAttempt.update({
      where: { guestId },
      data: { completedAt: new Date() },
    });
  }

  /** Called right after a guest completes signup. Links this attempt to
   * their new real account so getReport() can serve it. A guestId can
   * only ever be claimed once (no-op if already claimed by this same
   * student, e.g. a retried request) -- never reassignable to a
   * different student afterward. */
  async claimAttempt(guestId: string, userId: string): Promise<void> {
    const attempt = await prisma.guestDiagnosticAttempt.findUnique({ where: { guestId } });
    if (!attempt) return; // nothing to claim -- guest never started one, silently fine
    if (attempt.migratedToUserId && attempt.migratedToUserId !== userId) {
      throw new GuestDiagnosticError('This diagnostic result has already been claimed by a different account.');
    }
    if (attempt.migratedToUserId === userId) return; // already claimed by this same student
    await prisma.guestDiagnosticAttempt.update({ where: { guestId }, data: { migratedToUserId: userId } });
  }

  /** The report -- ONLY returned once claimAttempt() has run for this
   * exact userId (the signup gate, enforced here rather than just in the
   * UI). Deliberately measures performance only -- never rank, IQ/
   * intelligence framing, comparison with other students, or negative
   * labels like "weak"/"poor" (explicit requirement) -- "did well" vs
   * "needs more practice" are computed here (>=60% accuracy threshold,
   * simple and deterministic, no AI involved) and phrased encouragingly
   * for the frontend to render as-is. */
  async getReport(guestId: string, userId: string) {
    const attempt = await prisma.guestDiagnosticAttempt.findUniqueOrThrow({
      where: { guestId },
      include: {
        answers: {
          orderBy: { sequenceNumber: 'asc' },
          include: {
            question: {
              select: {
                questionText: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
                correctOption: true,
                explanationTa: true,
                explanationEn: true,
                language: true,
                subject: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (attempt.migratedToUserId !== userId) {
      throw new GuestDiagnosticError('Please sign up (or log in) to see your result.');
    }

    const answered = attempt.answers.filter((a) => a.answeredAt);
    const correctCount = answered.filter((a) => a.isCorrect).length;
    const wrongCount = answered.length - correctCount;
    const totalQuestions = attempt.answers.length;
    const accuracy = answered.length > 0 ? Math.round((correctCount / answered.length) * 100) : 0;

    const bySubject = new Map<string, { total: number; correct: number }>();
    for (const a of answered) {
      const name = a.question.subject?.name ?? 'Other';
      const entry = bySubject.get(name) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      bySubject.set(name, entry);
    }
    const subjectBreakdown = Array.from(bySubject.entries()).map(([subject, s]) => ({
      subject,
      correct: s.correct,
      total: s.total,
      accuracy: Math.round((s.correct / s.total) * 100),
    }));

    // Explicit requirement: never "weak"/"poor" -- a simple 60% split
    // into "did well" vs "needs more practice", both neutral/
    // encouraging framings of the exact same real numbers above.
    const didWell = subjectBreakdown.filter((s) => s.accuracy >= 60).map((s) => s.subject);
    const needsPractice = subjectBreakdown.filter((s) => s.accuracy < 60).map((s) => s.subject);

    const questionReview = attempt.answers.map((a) => {
      const correctText = { A: a.question.optionA, B: a.question.optionB, C: a.question.optionC, D: a.question.optionD }[a.question.correctOption];
      const selectedText = a.selectedOption ? { A: a.question.optionA, B: a.question.optionB, C: a.question.optionC, D: a.question.optionD }[a.selectedOption] : null;
      return {
        sequenceNumber: a.sequenceNumber,
        isCorrect: a.isCorrect,
        questionText: a.question.questionText,
        optionA: a.question.optionA,
        optionB: a.question.optionB,
        optionC: a.question.optionC,
        optionD: a.question.optionD,
        selectedOption: a.selectedOption,
        selectedText,
        correctOption: a.question.correctOption,
        correctText,
        explanation: a.question.language === 'TA' ? a.question.explanationTa : a.question.explanationEn,
      };
    });

    return {
      totalQuestions,
      answeredCount: answered.length,
      correctCount,
      wrongCount,
      accuracy,
      subjectBreakdown,
      didWell,
      needsPractice,
      questionReview,
    };
  }
}

export const guestDiagnosticService = new GuestDiagnosticService();
