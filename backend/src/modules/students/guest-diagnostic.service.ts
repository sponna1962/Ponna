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
  /** Sept 2026 (explicit requirement) — if the visitor already has an
   * INCOMPLETE attempt (started before, didn't finish), it's discarded
   * and a fresh one created -- NEVER resumed from halfway. A COMPLETED
   * attempt, on the other hand, is returned as-is (they already have a
   * real result; starting over would just lose it). */
  async startAttempt(guestId: string, subCategoryId: string, language: 'TA' | 'EN') {
    const existing = await prisma.guestDiagnosticAttempt.findUnique({ where: { guestId } });
    if (existing) {
      if (existing.completedAt) return existing;
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
   * redirect logic: does this device's guestId already have a COMPLETED
   * attempt? If not (either no attempt at all, or one still in
   * progress), the Welcome Screen should show again -- startAttempt()
   * above will discard any incomplete one and start fresh, never
   * resume. */
  async getStatus(guestId: string): Promise<{ completed: boolean }> {
    const attempt = await prisma.guestDiagnosticAttempt.findUnique({ where: { guestId }, select: { completedAt: true } });
    return { completed: !!attempt?.completedAt };
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
