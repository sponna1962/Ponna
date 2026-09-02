// Question Allocation Engine — implements §6.4 (Question Allocation Engine),
// the Current Affairs ratio/recency rules, and the finalized Practice
// Preference filtering (Language + Authority/Category/Sub-Category, resolved
// by practice-preference.service.ts into `taxonomyFilter` below).
//
// Priority order per session build:
//   1. Current Affairs questions (up to the configured cap for this session size,
//      pulled from within the recency window) — injected first
//   2. Unseen standard questions matching the requested Difficulty (mode)
//   3. Still short? Unseen standard questions of ANY Difficulty (finalized
//      requirement: Difficulty is the one dimension allowed to broaden when
//      the exact match runs out — never Language, never Authority/Category)
//
// NEVER repeats a question a student has already answered (finalized
// requirement — the question bank is large by design specifically so this
// isn't a practical constraint). If even the broadened unseen pool is
// exhausted, the session simply comes back with fewer questions than
// requested (down to zero) rather than repeating anything — the quiz UI
// shows "no questions available" for that case.
//
// Language is applied as its own independent filter, never combined with or
// implied by taxonomyFilter — the finalized rule is that Language is a pure
// content filter, not tied to any specific Authority.

import { Difficulty, QuizMode, QuestionCategory, Language, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';


export class AllocationService {
  async buildSessionQuestionIds(
    userId: string,
    mode: QuizMode,
    sessionSize: number,
    language: Language,
    taxonomyFilter: Prisma.QuestionWhereInput,
  ): Promise<string[]> {
    const settings = await prisma.platformSettings.findUniqueOrThrow({
      where: { id: 'singleton' },
    });

    const difficulties = this.difficultiesForMode(mode);
    const caCap = this.currentAffairsCapFor(sessionSize, settings);

    const selected: string[] = [];

    // ── Step 1: Current Affairs, within recency window, unseen first ──────────
    if (caCap > 0) {
      const recencyThreshold = daysAgo(settings.caRecencyWindowDays);
      const caQuestions = await prisma.question.findMany({
        where: {
          status: 'PUBLISHED',
          category: QuestionCategory.CURRENT_AFFAIRS,
          difficulty: { in: difficulties },
          language,
          relevanceDate: { gte: recencyThreshold },
          history: { none: { userId } }, // unseen by this student
          ...taxonomyFilter,
        },
        take: caCap,
        orderBy: { relevanceDate: 'desc' },
      });
      selected.push(...caQuestions.map((q) => q.id));
    }

    const remaining = sessionSize - selected.length;
    if (remaining <= 0) return selected;

    // ── Step 2: Unseen standard questions matching the requested Difficulty ────
    const unseen = await prisma.question.findMany({
      where: {
        status: 'PUBLISHED',
        difficulty: { in: difficulties },
        language,
        id: { notIn: selected },
        history: { none: { userId } },
        ...taxonomyFilter,
      },
      take: remaining,
      // Randomized ordering; for large tables swap this for a more scalable
      // random-sampling strategy (e.g. TABLESAMPLE) before production scale.
      orderBy: { createdAt: 'asc' },
    });
    selected.push(...unseen.map((q) => q.id));

    const stillRemaining = sessionSize - selected.length;
    if (stillRemaining <= 0) return selected;

    // ── Step 3: still short → broaden to ANY Difficulty (finalized requirement) ─
    // Only Difficulty relaxes here — Language and the Authority/Category
    // taxonomyFilter stay exactly as the student chose. This never repeats a
    // question (`history: { none }` still applies); if the unseen pool is
    // truly exhausted even at this broadened difficulty, the session just
    // comes back shorter than `sessionSize` (down to zero) rather than
    // reaching for a previously-answered question.
    const broadened = await prisma.question.findMany({
      where: {
        status: 'PUBLISHED',
        language,
        id: { notIn: selected },
        history: { none: { userId } },
        ...taxonomyFilter,
      },
      take: stillRemaining,
      orderBy: { createdAt: 'asc' },
    });
    selected.push(...broadened.map((q) => q.id));

    return selected;
  }

  private difficultiesForMode(mode: QuizMode): Difficulty[] {
    if (mode === 'MEDIUM') return [Difficulty.MEDIUM];
    if (mode === 'HARD') return [Difficulty.HARD];
    return [Difficulty.MEDIUM, Difficulty.HARD]; // MIXED
  }

  private currentAffairsCapFor(
    sessionSize: number,
    settings: { caMaxFor5Q: number; caMaxFor20Q: number; caMaxFor50Q: number },
  ): number {
    if (sessionSize <= 5) return settings.caMaxFor5Q;
    if (sessionSize <= 20) return settings.caMaxFor20Q;
    if (sessionSize <= 50) return settings.caMaxFor50Q;
    return Math.round((settings.caMaxFor50Q / 50) * sessionSize);
  }

}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
