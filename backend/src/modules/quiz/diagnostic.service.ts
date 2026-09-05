// Diagnostic Quiz at Signup (finalized requirement — world-class
// onboarding polish). Completely separate from normal Practice -- never
// touches quota/UserQuestionHistory/UserPerformanceSummary/ranking/
// no-repeat. One attempt ever, per student. Skippable, never forced.

import { CorrectOption } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const QUESTION_COUNT = 12;

export class DiagnosticError extends Error {}

export class DiagnosticService {
  async getState(userId: string) {
    const existing = await prisma.diagnosticAttempt.findUnique({ where: { userId } });
    if (!existing) return { access: 'NOT_STARTED' as const };
    if (!existing.completedAt) return { access: 'IN_PROGRESS' as const, attemptId: existing.id };
    return { access: 'COMPLETED' as const, attemptId: existing.id };
  }

  async start(userId: string) {
    const existing = await prisma.diagnosticAttempt.findUnique({ where: { userId } });
    if (existing) throw new DiagnosticError('Diagnostic already taken.');

    // A broad, mixed-difficulty, mixed-subject sample -- not tied to any
    // one exam's syllabus, since this runs before the student has
    // necessarily chosen one. Deliberately simple selection (no
    // allocation-engine complexity needed for a one-time, 12-question
    // sample).
    const questions = await prisma.question.findMany({
      where: { status: 'PUBLISHED' },
      take: QUESTION_COUNT,
      orderBy: { createdAt: 'asc' },
    });
    if (questions.length < QUESTION_COUNT) {
      throw new DiagnosticError('Not enough published questions available yet.');
    }

    const attempt = await prisma.diagnosticAttempt.create({
      data: {
        userId,
        answers: {
          create: questions.map((q, i) => ({ questionId: q.id, sequenceNumber: i + 1 })),
        },
      },
    });
    return { attemptId: attempt.id };
  }

  /** Immediate reveal, Daily-Quiz style -- this is a friendly onboarding
   * moment, not a proctored assessment, so instant feedback fits. */
  async getQuestions(userId: string, attemptId: string) {
    const attempt = await prisma.diagnosticAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { answers: { orderBy: { sequenceNumber: 'asc' }, include: { question: { include: { subject: true } } } } },
    });
    if (attempt.userId !== userId) throw new DiagnosticError('Not your attempt.');

    return attempt.answers.map((a) => ({
      id: a.questionId,
      sequenceNumber: a.sequenceNumber,
      questionText: a.question.questionText,
      optionA: a.question.optionA,
      optionB: a.question.optionB,
      optionC: a.question.optionC,
      optionD: a.question.optionD,
      answered: a.selectedOption !== null,
      selectedOption: a.selectedOption,
      isCorrect: a.isCorrect,
      correctOption: a.selectedOption !== null ? a.question.correctOption : null,
      subjectName: a.question.subject?.name ?? null,
    }));
  }

  async submitAnswer(userId: string, attemptId: string, questionId: string, selectedOption: CorrectOption) {
    const attempt = await prisma.diagnosticAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.userId !== userId) throw new DiagnosticError('Not your attempt.');
    if (attempt.completedAt) throw new DiagnosticError('This diagnostic is already complete.');

    const answerRow = await prisma.diagnosticAnswer.findUniqueOrThrow({ where: { attemptId_questionId: { attemptId, questionId } } });
    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.diagnosticAnswer.update({
      where: { id: answerRow.id },
      data: { selectedOption, isCorrect, answeredAt: new Date() },
    });

    return { isCorrect, correctOption: question.correctOption };
  }

  /** Returns a per-subject breakdown -- explicitly framed as a rough
   * starting impression (each subject typically has only 1-3 questions
   * in a 12-question sample), never as a trustworthy "accuracy" figure. */
  async complete(userId: string, attemptId: string) {
    const attempt = await prisma.diagnosticAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { answers: { include: { question: { include: { subject: true } } } } },
    });
    if (attempt.userId !== userId) throw new DiagnosticError('Not your attempt.');

    await prisma.diagnosticAttempt.update({ where: { id: attemptId }, data: { completedAt: new Date() } });

    const bySubject = new Map<string, { correct: number; total: number }>();
    for (const a of attempt.answers) {
      const key = a.question.subject?.name ?? 'General';
      const entry = bySubject.get(key) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      bySubject.set(key, entry);
    }

    const totalCorrect = attempt.answers.filter((a) => a.isCorrect).length;

    return {
      totalCorrect,
      totalQuestions: attempt.answers.length,
      bySubject: Array.from(bySubject.entries()).map(([subject, v]) => ({ subject, correct: v.correct, total: v.total })),
    };
  }
}
