// Wrong Questions Review (finalized requirement — student retention/
// learning value). A pure REVIEW screen, not a new quiz session: shows a
// student's own previously-wrong answers with the correct answer, so they
// can study their mistakes. Deliberately does NOT re-serve these
// questions through the normal allocation engine or create a new
// re-answerable session — the no-repeat rule for actual PRACTICE stays
// completely untouched; this is read-only review of history that already
// exists in UserQuestionHistory.

import { prisma } from '../../lib/prisma';

export class StudentReviewService {
  async listWrongQuestions(userId: string, limit = 50) {
    const rows = await prisma.userQuestionHistory.findMany({
      where: { userId, answeredCorrectly: false },
      orderBy: { answeredAt: 'desc' },
      take: limit,
      include: {
        question: {
          select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            correctOption: true,
            explanationTa: true,
            explanationEn: true,
            language: true,
            authority: { select: { name: true } },
          },
        },
      },
    });
    return rows.map((r) => ({
      answeredAt: r.answeredAt,
      difficulty: r.difficulty,
      question: r.question,
    }));
  }
}
