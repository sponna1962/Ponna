// Time-Management Analytics (finalized requirement — world-class polish,
// item 6). Purely additive read -- computed from QuizSessionQuestion's
// timeSpentSeconds (recorded client-side at answer time), never affects
// scoring/quota/ranking. Framed for the UI as "room to improve", not a
// negative judgement -- see the Dashboard label text.

import { prisma } from '../../lib/prisma';

export async function getTimeAnalytics(userId: string) {
  const rows = await prisma.quizSessionQuestion.findMany({
    where: {
      session: { userId },
      answered: true,
      timeSpentSeconds: { not: null },
    },
    select: { timeSpentSeconds: true, question: { select: { difficulty: true } } },
  });

  if (rows.length === 0) return null;

  const byDifficulty = new Map<string, { total: number; count: number }>();
  let overallTotal = 0;

  for (const r of rows) {
    const key = r.question.difficulty ?? 'UNKNOWN';
    const entry = byDifficulty.get(key) ?? { total: 0, count: 0 };
    entry.total += r.timeSpentSeconds!;
    entry.count += 1;
    byDifficulty.set(key, entry);
    overallTotal += r.timeSpentSeconds!;
  }

  return {
    overallAverageSeconds: Math.round(overallTotal / rows.length),
    byDifficulty: Array.from(byDifficulty.entries())
      .filter(([k]) => k !== 'UNKNOWN')
      .map(([difficulty, v]) => ({ difficulty, averageSeconds: Math.round(v.total / v.count), sampleSize: v.count })),
  };
}
