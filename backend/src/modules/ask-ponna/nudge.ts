// Ask Ponna Nudge — a proactive, single-line insight on the Dashboard
// (finalized requirement: "world-class" polish, proactive not just
// reactive). Deliberately RULE-BASED, not an AI call — computed directly
// from existing PONNA data (no extra Gemini request per dashboard load,
// consistent with the explicit near-zero-cost priority behind choosing
// Gemini in the first place). The nudge just links into the normal Ask
// Ponna chat with a pre-filled message — the actual AI conversation still
// happens through the existing, already-built chat pipeline.

import { prisma } from '../../lib/prisma';

export type AskPonnaNudge = { message: string; suggestedMessage: string } | null;

export async function getNudge(userId: string): Promise<AskPonnaNudge> {
  const [lastSession, lastDailyQuiz, weakestBucket, pendingMistakeCount] = await Promise.all([
    prisma.quizSession.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.dailyQuizAttempt.findFirst({ where: { userId }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
    prisma.userPerformanceSummary.findFirst({
      where: { userId, questionsAnswered: { gte: 5 }, bucket: { not: 'OVERALL' } }, // OVERALL isn't a specific, actionable area; MEDIUM/HARD are the meaningful buckets here
      orderBy: { averagePercent: 'asc' },
    }),
    prisma.mistakeReview.count({ where: { userId, status: 'PENDING' } }),
  ]);

  const daysSinceActivity = (() => {
    const mostRecent = [lastSession?.createdAt, lastDailyQuiz?.startedAt].filter(Boolean).sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0];
    if (!mostRecent) return null;
    return Math.floor((Date.now() - (mostRecent as Date).getTime()) / (1000 * 60 * 60 * 24));
  })();

  // Priority order: long inactivity first (most important to re-engage),
  // then a real, reliably-weak subject, then a pending-mistakes reminder.
  // Returns null (no card shown at all) if nothing meaningful applies —
  // never a generic filler nudge with nothing behind it.
  if (daysSinceActivity !== null && daysSinceActivity >= 3) {
    return {
      message: `${daysSinceActivity} நாட்களா நீங்கள் practice பண்ணவில்லை, எல்லாம் நலமா? 😊`,
      suggestedMessage: 'நான் சில நாட்களா practice பண்ணவில்லை, எப்படி மீண்டும் தொடங்குவது?',
    };
  }

  if (weakestBucket && weakestBucket.averagePercent < 50) {
    const levelLabel = weakestBucket.bucket === 'HARD' ? 'கடினமான' : 'நடுத்தர';
    return {
      message: `${levelLabel} கேள்விகளில் உங்கள் accuracy ${Math.round(weakestBucket.averagePercent)}% — இன்று கொஞ்சம் அதை practice பண்ணலாமா?`,
      suggestedMessage: `${levelLabel} கேள்விகள்-ல் நான் weak-ஆக இருக்கு, எப்படி மேம்படுத்துவது?`,
    };
  }

  if (pendingMistakeCount >= 5) {
    return {
      message: `உங்களிடம் ${pendingMistakeCount} தவறுகள் இன்னும் review செய்யப்படவில்லை — ஒரு 5 நிமிடம் ஒதுக்கலாமா?`,
      suggestedMessage: 'என் தவறுகளை ஆய்வு செய்து, என்ன பலவீனம் என்று சொல்லுங்கள்.',
    };
  }

  return null;
}
