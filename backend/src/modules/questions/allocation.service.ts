// Question Allocation Engine — strict Subject/Topic Preference scoping.
// When a student selects a Subject/Topic Preference, EVERY allocated
// question must belong to one of those selected subjects/topics. The old
// 75/25 Preferred/General weighting intentionally mixed general questions
// into the same session; that is not acceptable when the student explicitly
// asks to practise a particular subject.
//
// Rules:
// 1. Current Affairs is also scoped by the selected Subject/Topic when a
//    preference exists; it must not silently introduce questions from other
//    subjects.
// 2. With no preference, the normal full-syllabus allocation remains.
// 3. With a preference, shortage is handled only by broadening Difficulty —
//    never by leaving the selected Subject/Topic.
// 4. Never repeat a question already answered by the student.
// 5. Language, Authority/Category/Sub-Category and audit-status filters
//    remain hard filters.

import { Difficulty, QuizMode, QuestionCategory, Language, Prisma, SourceType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const ORIGINAL_SOURCE_TARGET_RATIO = 0.7;

// A question with an unresolved audit flag must never be served.
const NOT_PENDING_AUDIT_REVIEW = { auditFlags: { none: { status: { not: 'DISMISSED' as const } } } };

export type SubjectTopicPreference = { subjectIds: string[]; topicIds: string[] } | null;

export class AllocationService {
  private async fetchWithSourcePriority(where: Prisma.QuestionWhereInput, take: number): Promise<{ id: string }[]> {
    if (take <= 0) return [];

    const originalTarget = Math.round(take * ORIGINAL_SOURCE_TARGET_RATIO);
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
    const hasPreference = !!preference && (preference.subjectIds.length > 0 || preference.topicIds.length > 0);
    const preferredFilter = hasPreference ? await this.resolvePreferredFilter(preference!) : null;

    // Current Affairs remains part of the session, but when the student has
    // explicitly selected Subject/Topic Preference it is HARD-SCOPED to that
    // preference too. This prevents a subject-specific practice session from
    // suddenly alternating with unrelated Current Affairs questions.
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
          history: { none: { userId } },
          ...taxonomyFilter,
          ...(preferredFilter ?? {}),
        },
        take: caCap,
        orderBy: { relevanceDate: 'desc' },
      });
      selected.push(...caQuestions.map((q) => q.id));
    }

    const remaining = sessionSize - selected.length;
    if (remaining <= 0) return selected;

    // NO preference: preserve normal full-syllabus behaviour.
    if (!hasPreference) {
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
      // STRICT Subject/Topic Preference:
      // There is intentionally NO General pool here. Every question must
      // match the student's selected Subject or Topic. If the exact
      // difficulty pool is short, we broaden Difficulty only, while keeping
      // the Subject/Topic filter, Language and exam taxonomy untouched.
      const preferredQuestions = await this.fetchWithSourcePriority(
        {
          status: 'PUBLISHED',
          ...NOT_PENDING_AUDIT_REVIEW,
          difficulty: { in: difficulties },
          language,
          id: { notIn: selected },
          history: { none: { userId } },
          ...taxonomyFilter,
          ...preferredFilter!,
        },
        remaining,
      );
      selected.push(...preferredQuestions.map((q) => q.id));
    }

    const stillRemaining = sessionSize - selected.length;
    if (stillRemaining <= 0) return selected;

    // Final fallback: broaden Difficulty ONLY. If a Subject/Topic Preference
    // exists, it is retained here as a hard boundary. This guarantees that
    // a student asking for one subject never receives another subject merely
    // to fill the requested question count.
    const broadened = await this.fetchWithSourcePriority(
      {
        status: 'PUBLISHED',
        ...NOT_PENDING_AUDIT_REVIEW,
        language,
        id: { notIn: selected },
        history: { none: { userId } },
        ...taxonomyFilter,
        ...(preferredFilter ?? {}),
      },
      stillRemaining,
    );
    selected.push(...broadened.map((q) => q.id));

    return selected;
  }

  /**
   * Subject preference matches the parent Subject. Topic preference matches
   * the exact Topic. Multiple selected subjects/topics are an OR within the
   * student's chosen set.
   *
   * Two independent taxonomies both tag questions with a subject: the
   * SyllabusSubject/SyllabusTopic tree (Question.syllabusTopicId) that this
   * selector is built from, and the flat Subject a staff member tags a
   * question with directly (Question.subjectId) — which is how most
   * bulk-imported questions are actually tagged. A question matches this
   * preference if EITHER path resolves it: a direct syllabusTopicId/
   * syllabusTopic.subjectId match, OR its flat subjectId is the one linked
   * to the selected SyllabusSubject(s) via SyllabusSubject.linkedSubjectId.
   * Without the second path, a Subject Preference silently returns zero
   * questions whenever the matching content was tagged the flat-Subject way
   * — this was a real, reported bug (Sept 2026).
   */
  private async resolvePreferredFilter(preference: { subjectIds: string[]; topicIds: string[] }): Promise<Prisma.QuestionWhereInput> {
    const or: Prisma.QuestionWhereInput[] = [];
    if (preference.topicIds.length > 0) {
      or.push({ syllabusTopicId: { in: preference.topicIds } });
    }
    if (preference.subjectIds.length > 0) {
      or.push({ syllabusTopic: { subjectId: { in: preference.subjectIds } } });
    }

    // Resolve linked flat Subjects for: subjects selected directly, and the
    // parent subject of any topic selected directly (selecting a topic
    // implies its subject's flat-tagged questions are also in scope).
    const topicParentSubjectIds = preference.topicIds.length > 0
      ? (await prisma.syllabusTopic.findMany({ where: { id: { in: preference.topicIds } }, select: { subjectId: true } })).map((t) => t.subjectId)
      : [];
    const allSyllabusSubjectIds = Array.from(new Set([...preference.subjectIds, ...topicParentSubjectIds]));
    if (allSyllabusSubjectIds.length > 0) {
      const linked = await prisma.syllabusSubject.findMany({
        where: { id: { in: allSyllabusSubjectIds } },
        select: { linkedSubjectIds: true },
      });
      const flatSubjectIds = Array.from(new Set(linked.flatMap((s) => s.linkedSubjectIds)));
      if (flatSubjectIds.length > 0) {
        or.push({ subjectId: { in: flatSubjectIds } });
      }
    }

    return { OR: or };
  }

  private difficultiesForMode(mode: QuizMode): Difficulty[] {
    if (mode === 'MEDIUM') return [Difficulty.MEDIUM];
    if (mode === 'HARD') return [Difficulty.HARD];
    return [Difficulty.MEDIUM, Difficulty.HARD];
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
