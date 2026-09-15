// Question Allocation Engine — implements §6.4 (Question Allocation Engine),
// the Current Affairs ratio/recency rules, and the finalized Practice
// Preference filtering (Language + Authority/Category/Sub-Category, resolved
// by practice-preference.service.ts into `taxonomyFilter` below).
//
// Priority order per session build:
//   1. Current Affairs questions (up to the configured cap for this session size,
//      pulled from within the recency window) — injected first, completely
//      independent of Subject/Topic Preference (Stage 2 never touches this step)
//   2. Unseen standard questions matching the requested Difficulty (mode) —
//      IF the student has a saved Subject/Topic Preference for this exam
//      (finalized requirement, Stage 2), this step itself is split into a
//      Preferred sub-pool (subjectTopicPreferenceWeightPercent of the
//      remaining budget, default 75%) and a General sub-pool (the rest) —
//      see resolvePreferredFilter below. With no saved preference, this
//      step is byte-identical to before Stage 2 existed.
//   3. Still short? Unseen standard questions of ANY Difficulty (finalized
//      requirement: Difficulty is the one dimension allowed to broaden when
//      the exact match runs out — never Language, never Authority/Category,
//      and never re-applies the Preferred/General split — this final
//      fallback tier exists purely to guarantee the session still
//      completes, exactly as it did before Stage 2)
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

import { Difficulty, QuizMode, QuestionCategory, Language, Prisma, SourceType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

// Sept 2026 (Source-Priority, explicit request) — PONNA's own
// ORIGINAL-authored questions get priority over old previous-exam
// papers, since the latter risk a student pattern-matching a
// memorized answer instead of engaging with the content (see
// this same session's Option Shuffling work for the related concern).
// 70% target, backfilled from whatever's left when ORIGINAL supply is
// short for a given Subject/Difficulty/exam combination -- deliberately
// NEVER reaches outside the caller's own `where` clause (which already
// carries the taxonomyFilter scoping to one exam), so backfill only ever
// pulls from the SAME exam's own PREVIOUS_EXAM/BOOK/OTHER questions,
// never a different exam's -- explicitly confirmed as a hard requirement.
const ORIGINAL_SOURCE_TARGET_RATIO = 0.7;

// Sept 2026 (BINDING, data-quality safety) — a question with an
// unreviewed (OPEN) AI Question Audit flag must NEVER be served to a
// student in Practice or Live Exam until an admin has reviewed it
// (CONFIRMED or DISMISSED, via the existing Question Audit review page).
// A CONFIRMED flag means the admin still needs to go fix the question
// separately (this exclusion doesn't un-flag it) — a DISMISSED one means
// the admin decided there's no real issue, so the question becomes
// eligible again immediately. Spread into every question-fetch query in
// this file, right alongside status: 'PUBLISHED'.
// Sept 2026 (BINDING, data-quality safety) — a question with any
// unresolved audit flag (OPEN: not yet reviewed, or CONFIRMED: admin
// agreed it's a real issue but hasn't fixed the question yet) must
// never be served to a student in Practice or Live Exam. Only DISMISSED
// (admin decided there's no real issue, OR the question was actually
// edited -- see questionService.update()'s own auto-dismiss step,
// which is what lets a CONFIRMED-then-fixed question become eligible
// again) clears this. Spread into every question-fetch query in this
// file, right alongside status: 'PUBLISHED'.
const NOT_PENDING_AUDIT_REVIEW = { auditFlags: { none: { status: { not: 'DISMISSED' as const } } } };

/** A student's saved Subject/Topic Preference for the exam they're
 * currently practicing (Stage 1 storage, resolved by session.service.ts
 * before calling buildSessionQuestionIds — see
 * practice-preference.service.ts's extractSingleSubCategoryId). Both
 * arrays empty is treated identically to no preference at all — Stage 1
 * explicitly allows saving an empty preference as "no preference, thanks."
 */
export type SubjectTopicPreference = { subjectIds: string[]; topicIds: string[] } | null;

export class AllocationService {
  /** See this file's own ORIGINAL_SOURCE_TARGET_RATIO comment for the full
   * design. `where` must already include every filter the caller needs
   * (difficulty, language, taxonomyFilter, id: { notIn: [...already
   * selected across the whole session] }, etc.) -- this helper only adds
   * the sourceType priority/backfill split on top, never removes or
   * loosens anything the caller already scoped. */
  private async fetchWithSourcePriority(where: Prisma.QuestionWhereInput, take: number): Promise<{ id: string }[]> {
    if (take <= 0) return [];

    const originalTarget = Math.round(take * ORIGINAL_SOURCE_TARGET_RATIO);
    // Sept 2026 — SourceType.ORIGINAL (the enum object) is unavailable
    // here at RUNTIME in this environment (a sandbox-wide Prisma-client
    // generation quirk, confirmed via a direct `node -e` check finding
    // EVERY enum's runtime object undefined, not just this one) --
    // string literals typed against the enum, matching this codebase's
    // own established pattern elsewhere (e.g. status: 'PUBLISHED'),
    // avoid the issue entirely since TypeScript's enum TYPES still work
    // fine, only the runtime VALUE object doesn't.
    const originalQuestions = await prisma.question.findMany({
      where: { ...where, sourceType: 'ORIGINAL' as SourceType },
      take: originalTarget,
      orderBy: { createdAt: 'asc' },
    });

    const stillNeeded = take - originalQuestions.length;
    if (stillNeeded <= 0) return originalQuestions;

    const existingNotIn = ((where.id as Prisma.StringFilter)?.notIn ?? []) as string[];
    const backfill = await prisma.question.findMany({
      where: {
        ...where,
        sourceType: { not: 'ORIGINAL' as SourceType },
        id: { notIn: [...existingNotIn, ...originalQuestions.map((q) => q.id)] },
      },
      take: stillNeeded,
      orderBy: { createdAt: 'asc' },
    });

    return [...originalQuestions, ...backfill];
  }

  async buildSessionQuestionIds(
    userId: string,
    mode: QuizMode,
    sessionSize: number,
    language: Language,
    taxonomyFilter: Prisma.QuestionWhereInput,
    preference: SubjectTopicPreference = null,
  ): Promise<string[]> {
    const settings = await prisma.platformSettings.findUniqueOrThrow({
      where: { id: 'singleton' },
    });

    const difficulties = this.difficultiesForMode(mode);
    const caCap = this.currentAffairsCapFor(sessionSize, settings);

    const selected: string[] = [];

    // ── Step 1: Current Affairs, within recency window, unseen first ──────────
    // Completely independent of Subject/Topic Preference — Stage 2 never
    // touches this step, per the confirmed design ("Current Affairs
    // handling" stays exactly as-is).
    if (caCap > 0) {
      const recencyThreshold = daysAgo(settings.caRecencyWindowDays);
      const caQuestions = await prisma.question.findMany({
        where: {
          status: 'PUBLISHED',
          ...NOT_PENDING_AUDIT_REVIEW,
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

    const hasPreference = !!preference && (preference.subjectIds.length > 0 || preference.topicIds.length > 0);

    // ── Step 2: Unseen standard questions matching the requested Difficulty ────
    if (!hasPreference) {
      // Byte-identical filter set to the pre-Stage-2 query -- no
      // preference saved (or an explicitly empty one) means zero
      // behavior change apart from the Source-Priority split now
      // applied on top (Sept 2026, explicit request).
      const unseen = await this.fetchWithSourcePriority(
        {
          status: 'PUBLISHED',
          ...NOT_PENDING_AUDIT_REVIEW,
          difficulty: { in: difficulties },
          language,
          id: { notIn: selected },
          history: { none: { userId } },
          ...taxonomyFilter,
        },
        remaining,
      );
      selected.push(...unseen.map((q) => q.id));
    } else {
      // Stage 2 — split the "remaining" (non-CA) budget between the
      // student's Preferred pool and the General pool, per the confirmed
      // 75/25 (configurable) design.
      const weightPercent = settings.subjectTopicPreferenceWeightPercent;
      const preferredTarget = Math.round((remaining * weightPercent) / 100);

      const preferredFilter = this.resolvePreferredFilter(preference!);
      const preferredQuestions = await this.fetchWithSourcePriority(
        {
          status: 'PUBLISHED',
          ...NOT_PENDING_AUDIT_REVIEW,
          difficulty: { in: difficulties },
          language,
          id: { notIn: selected },
          history: { none: { userId } },
          ...taxonomyFilter,
          ...preferredFilter,
        },
        preferredTarget,
      );
      selected.push(...preferredQuestions.map((q) => q.id));

      // Graceful fallback (finalized requirement) — the General target is
      // simply "whatever's left of the non-CA budget after the Preferred
      // pool's ACTUAL yield" — this naturally absorbs any shortfall
      // without needing a separate calculation: if the Preferred pool came
      // up short of its 75% target, General's share grows to compensate,
      // so the session still completes at this Difficulty tier before
      // ever reaching Step 3's broadened fallback.
      const generalTarget = remaining - preferredQuestions.length;

      if (generalTarget > 0) {
        // Deliberately NOT filtered by preferredFilter — this is the
        // General pool, drawn from the same eligible-pool query as
        // before Stage 2 existed (untagged questions, i.e.
        // syllabusTopicId is null, land here naturally and continue
        // working exactly as before — finalized requirement).
        const generalQuestions = await this.fetchWithSourcePriority(
          {
            status: 'PUBLISHED',
            ...NOT_PENDING_AUDIT_REVIEW,
            difficulty: { in: difficulties },
            language,
            id: { notIn: selected },
            history: { none: { userId } },
            ...taxonomyFilter,
          },
          generalTarget,
        );
        selected.push(...generalQuestions.map((q) => q.id));
      }
    }

    const stillRemaining = sessionSize - selected.length;
    if (stillRemaining <= 0) return selected;

    // ── Step 3: still short → broaden to ANY Difficulty (finalized requirement) ─
    // Only Difficulty relaxes here — Language and the Authority/Category
    // taxonomyFilter stay exactly as the student chose. This never repeats a
    // question (`history: { none }` still applies); if the unseen pool is
    // truly exhausted even at this broadened difficulty, the session just
    // comes back shorter than `sessionSize` (down to zero) rather than
    // reaching for a previously-answered question. Deliberately does NOT
    // re-apply the Preferred/General split — this tier exists purely to
    // guarantee the session still completes, exactly as it did before
    // Stage 2 existed.
    const broadened = await this.fetchWithSourcePriority(
      {
        status: 'PUBLISHED',
        ...NOT_PENDING_AUDIT_REVIEW,
        language,
        id: { notIn: selected },
        history: { none: { userId } },
        ...taxonomyFilter,
      },
      stillRemaining,
    );
    selected.push(...broadened.map((q) => q.id));

    return selected;
  }

  /** Subject-level preference matches on the topic's parent Subject;
   * Topic-level preference matches the exact Topic — both confirmed
   * required by the finalized design ("Subject Preference -> priority
   * to questions from that subject. Topic Preference -> priority to
   * questions from that specific topic."). A question with no
   * syllabusTopicId at all can never match either branch, which is
   * exactly what sends it to the General pool instead. */
  private resolvePreferredFilter(preference: { subjectIds: string[]; topicIds: string[] }): Prisma.QuestionWhereInput {
    const or: Prisma.QuestionWhereInput[] = [];
    if (preference.topicIds.length > 0) {
      or.push({ syllabusTopicId: { in: preference.topicIds } });
    }
    if (preference.subjectIds.length > 0) {
      or.push({ syllabusTopic: { subjectId: { in: preference.subjectIds } } });
    }
    return { OR: or };
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

