// Review Mistakes (finalized requirement) — a REVISION flow, strictly
// separate from normal Practice. recordMistake() is called as a
// side-effect of session.service.ts's submitAnswer (never the other way
// around); everything else here is this feature's own, sealed world —
// reviewAnswer() NEVER writes to UserQuestionHistory, ranking, quota, or
// touches Subject/Topic Preference allocation in any way.

import { CorrectOption, MistakeReviewStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class MistakeReviewService {
  /** Called by session.service.ts's submitAnswer whenever a normal
   * Practice answer is wrong. Upsert, not create — defensively resets an
   * already-CORRECTED row back to PENDING too, though in practice the
   * no-repeat rule means normal Practice can never re-serve the same
   * question to re-trigger this once a row exists. */
  async recordMistake(userId: string, questionId: string): Promise<void> {
    await prisma.mistakeReview.upsert({
      where: { userId_questionId: { userId, questionId } },
      create: { userId, questionId, status: MistakeReviewStatus.PENDING },
      update: { status: MistakeReviewStatus.PENDING },
    });
  }

  private async hasPaidAccess(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isTestAccount: true } });
    if (user?.isTestAccount) return true;
    const activeSub = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false } },
    });
    return !!activeSub;
  }

  /** filter: 'all' | 'subject' | 'recent'. 'subject' groups by the
   * question's flat Subject tag (untagged questions land in an
   * "Other"/null bucket, never dropped) — deliberately the existing flat
   * Subject model, not the Syllabus hierarchy, since that's what
   * Questions are actually tagged with today. 'recent' just orders by
   * most-recently-mistaken first (createdAt desc); 'all' is the same,
   * ungrouped. */
  async listMistakes(userId: string, filter: 'all' | 'subject' | 'recent' = 'all') {
    if (!(await this.hasPaidAccess(userId))) {
      return { access: 'FREE_LOCKED' as const };
    }

    const rows = await prisma.mistakeReview.findMany({
      where: { userId, status: MistakeReviewStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      include: {
        question: {
          select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            subject: { select: { name: true } },
            language: true,
          },
        },
      },
    });

    const items = rows.map((r) => ({
      questionId: r.questionId,
      questionText: r.question.questionText,
      optionA: r.question.optionA,
      optionB: r.question.optionB,
      optionC: r.question.optionC,
      optionD: r.question.optionD,
      subjectName: r.question.subject?.name ?? null,
      language: r.question.language,
      mistakenAt: r.createdAt,
    }));

    if (filter === 'subject') {
      const groups = new Map<string, typeof items>();
      for (const item of items) {
        const key = item.subjectName ?? 'Other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
      }
      return { access: 'AVAILABLE' as const, grouped: Array.from(groups.entries()).map(([subject, questions]) => ({ subject, questions })) };
    }

    return { access: 'AVAILABLE' as const, items };
  }

  /**
   * A revision attempt — checks correctness and updates ONLY this row's
   * status (CORRECTED if right, stays PENDING if wrong). Deliberately
   * does not touch UserQuestionHistory, ranking.updateSummaryAfterAnswer,
   * quota, or anything Subject/Topic-Preference-related — those stay
   * completely untouched by this flow, per explicit instruction.
   */
  async reviewAnswer(userId: string, questionId: string, selectedOption: CorrectOption) {
    const mistake = await prisma.mistakeReview.findUnique({ where: { userId_questionId: { userId, questionId } } });
    if (!mistake) throw new Error('This question is not in your Review Mistakes list.');

    const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
    const isCorrect = question.correctOption === selectedOption;

    await prisma.mistakeReview.update({
      where: { id: mistake.id },
      data: {
        status: isCorrect ? MistakeReviewStatus.CORRECTED : MistakeReviewStatus.PENDING,
        lastReviewedAt: new Date(),
      },
    });

    return {
      isCorrect,
      correctOption: question.correctOption,
      explanation: question.language === 'TA' ? question.explanationTa : question.explanationEn,
    };
  }
}
