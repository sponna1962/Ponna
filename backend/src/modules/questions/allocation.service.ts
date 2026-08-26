// Question Allocation Engine — implements §6.4 (Question Allocation & Repetition Engine),
// the Current Affairs ratio/recency rules, and the finalized Practice
// Preference filtering (Language + Authority/Category/Sub-Category, resolved
// by practice-preference.service.ts into `taxonomyFilter` below).
//
// Priority order per session build:
//   1. Current Affairs questions (up to the configured cap for this session size,
//      pulled from within the recency window) — injected first
//   2. Unseen standard questions matching mode/difficulty
//   3. Only if unseen pool is exhausted: previously answered questions, oldest-first
//      (or per whatever repetitionStrategy is configured)
//
// Language is applied as its own independent filter, never combined with or
// implied by taxonomyFilter — the finalized rule is that Language is a pure
// content filter, not tied to any specific Authority.

import { PrismaClient, Difficulty, QuizMode, QuestionCategory, Language, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

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

    // ── Step 2: Unseen standard questions ──────────────────────────────────────
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

    // ── Step 3: Unseen pool exhausted → apply repetition policy ────────────────
    const repeatPool = await this.getRepeatPool(
      userId,
      difficulties,
      language,
      taxonomyFilter,
      selected,
      stillRemaining,
      settings.repetitionStrategy,
      settings.repeatAfterDays,
    );
    selected.push(...repeatPool);

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

  private async getRepeatPool(
    userId: string,
    difficulties: Difficulty[],
    language: Language,
    taxonomyFilter: Prisma.QuestionWhereInput,
    excludeIds: string[],
    take: number,
    strategy: string,
    repeatAfterDays: number | null,
  ): Promise<string[]> {
    const baseWhere: Prisma.QuestionWhereInput = {
      status: 'PUBLISHED',
      difficulty: { in: difficulties },
      language,
      id: { notIn: excludeIds },
      history: { some: { userId } },
      ...taxonomyFilter,
    };

    if (strategy === 'REPEAT_AFTER_DAYS' && repeatAfterDays) {
      const cutoff = daysAgo(repeatAfterDays);
      const eligible = await prisma.question.findMany({
        where: { ...baseWhere, history: { some: { userId, answeredAt: { lt: cutoff } } } },
        take,
      });
      return eligible.map((q) => q.id);
    }

    // Default: UNSEEN_FIRST_THEN_OLDEST — least-recently-answered first.
    // Applying taxonomyFilter here means going through the `question` relation.
    const history = await prisma.userQuestionHistory.findMany({
      where: {
        userId,
        difficulty: { in: difficulties },
        questionId: { notIn: excludeIds },
        question: { language, ...taxonomyFilter },
      },
      orderBy: { answeredAt: 'asc' },
      take,
      select: { questionId: true },
    });
    return history.map((h) => h.questionId);
  }
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
