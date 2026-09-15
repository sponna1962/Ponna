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
  async startAttempt(guestId: string, subCategoryId: string) {
    const existing = await prisma.guestDiagnosticAttempt.findUnique({ where: { guestId } });
    if (existing) return existing;

    const questions = await prisma.question.findMany({
      where: {
        status: 'PUBLISHED',
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
   * UI). Per-subject breakdown, same spirit as the existing
   * DiagnosticAttempt flow inside Ask Ponna's own "How to Prepare"
   * warm-up, just for this separate signup-less entry point. */
  async getReport(guestId: string, userId: string) {
    const attempt = await prisma.guestDiagnosticAttempt.findUniqueOrThrow({
      where: { guestId },
      include: { answers: { include: { question: { select: { subject: { select: { name: true } } } } } } },
    });
    if (attempt.migratedToUserId !== userId) {
      throw new GuestDiagnosticError('Please sign up (or log in) to see your result.');
    }

    const answered = attempt.answers.filter((a) => a.answeredAt);
    const correct = answered.filter((a) => a.isCorrect).length;

    const bySubject = new Map<string, { total: number; correct: number }>();
    for (const a of answered) {
      const name = a.question.subject?.name ?? 'Other';
      const entry = bySubject.get(name) ?? { total: 0, correct: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      bySubject.set(name, entry);
    }

    return {
      totalQuestions: attempt.answers.length,
      answeredCount: answered.length,
      correctCount: correct,
      subjectBreakdown: Array.from(bySubject.entries()).map(([subject, s]) => ({ subject, ...s })),
    };
  }
}

export const guestDiagnosticService = new GuestDiagnosticService();
