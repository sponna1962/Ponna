// Question Allocation Engine — balanced, random, strictly scoped.
//
// What a practice session contains:
//  1. Current Affairs (capped, newest first) — unchanged.
//  2. The rest is spread ACROSS SUBJECTS and chosen AT RANDOM:
//     - Student picked Subject/Topic Preference: every question belongs to
//       one of the chosen subjects/topics (hard boundary, never widened) and
//       the chosen subjects share the session EQUALLY.
//     - No preference, one exam selected (e.g. Group IV): the exam's syllabus
//       subjects share the session by their practiceWeight (default 1), so the
//       mix follows the real paper instead of whichever content was uploaded
//       first.
//     - Anything broader: one random draw from the whole eligible pool.
//     Inside a subject: ORIGINAL questions first (70% target), then real
//     PREVIOUS_EXAM questions (30% of the rest, spread across different
//     papers), then BOOK/OTHER; a source
//     that runs short is topped up from the others.
//  3. If a subject cannot supply its share, the others cover it. Difficulty is
//     broadened only if the mode's difficulty pool is short — never the
//     subject boundary.
//  4. Never repeat a question the student already answered.
//  5. Language, Authority/Category/Sub-Category and audit-status filters stay
//     hard filters. The session order is shuffled at the end.
//
// (Before Oct 2026 this simply took the OLDEST uploaded questions first, so a
// new student got whatever subject had been uploaded earliest — mostly
// Tamil — and the Subject Preference filter replaced, instead of combining
// with, the exam taxonomy filter.)

import { Difficulty, QuizMode, QuestionCategory, Language, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { apportion, pickMixed, shuffleInPlace, Candidate, SourceMix } from './allocation-mix';

export const SOURCE_MIX: SourceMix = { originalRatio: 0.7, previousExamRatio: 0.3 };

// Upper bound of candidate ids pulled per subject per draw. Every subject pool
// we have today is far below this; for a very large pool a random window of
// this size is used, so the draw stays random without loading everything.
const CANDIDATE_CAP = 6000;

// A question with an unresolved audit flag must never be served.
const NOT_PENDING_AUDIT_REVIEW = { auditFlags: { none: { status: { not: 'DISMISSED' as const } } } };

export type SubjectTopicPreference = { subjectIds: string[]; topicIds: string[] } | null;

type Bucket = { name: string; filter: Prisma.QuestionWhereInput; weight: number };

export class AllocationService {
  private async fetchCandidates(where: Prisma.QuestionWhereInput): Promise<Candidate[]> {
    const select = { id: true, sourceType: true, sourceName: true, examYear: true } as const;
    let rows = await prisma.question.findMany({ where, select, orderBy: { id: 'asc' }, take: CANDIDATE_CAP });
    if (rows.length >= CANDIDATE_CAP) {
      const total = await prisma.question.count({ where });
      const skip = Math.floor(Math.random() * (total - CANDIDATE_CAP + 1));
      rows = await prisma.question.findMany({ where, select, orderBy: { id: 'asc' }, skip, take: CANDIDATE_CAP });
    }
    return rows.map((r) => ({ id: r.id, sourceType: r.sourceType, paperKey: `${r.sourceName ?? ''}|${r.examYear ?? ''}` }));
  }

  /**
   * Draw `need` questions spread across the buckets by weight. Buckets are
   * read in parallel, then shares are computed against what each bucket can
   * really supply, so a short bucket's share moves to the others.
   */
  private async drawFromBuckets(
    buckets: Bucket[],
    baseWhere: Prisma.QuestionWhereInput[],
    need: number,
    used: Set<string>,
  ): Promise<string[]> {
    if (need <= 0 || buckets.length === 0) return [];
    const exclude: Prisma.QuestionWhereInput[] = used.size > 0 ? [{ id: { notIn: Array.from(used) } }] : [];

    const pools = await Promise.all(
      buckets.map((b) => this.fetchCandidates({ AND: [...baseWhere, ...exclude, b.filter] })),
    );

    const picked: string[] = [];
    // Two rounds: a question can match two buckets, so after the first round
    // some pools may have lost items; the second round tops up the gap.
    for (let round = 0; round < 2 && picked.length < need; round++) {
      const taken = new Set(picked);
      const live = pools.map((p) => p.filter((c) => !taken.has(c.id) && !used.has(c.id)));
      const counts = apportion(buckets.map((b) => b.weight), live.map((p) => p.length), need - picked.length);
      for (let i = 0; i < buckets.length; i++) {
        const fresh = live[i].filter((c) => !picked.includes(c.id));
        for (const c of pickMixed(fresh, counts[i], SOURCE_MIX)) picked.push(c.id);
      }
    }
    for (const id of picked) used.add(id);
    return picked;
  }

  /** The subject buckets for this student's session, or null for one open draw. */
  private async buildBuckets(
    preference: SubjectTopicPreference,
    subCategoryId: string | null | undefined,
  ): Promise<Bucket[] | null> {
    const hasPreference = !!preference && (preference.subjectIds.length > 0 || preference.topicIds.length > 0);

    if (hasPreference) {
      // Equal share for every chosen subject. A topic chosen on its own is
      // grouped under its parent subject.
      const topics = preference!.topicIds.length > 0
        ? await prisma.syllabusTopic.findMany({ where: { id: { in: preference!.topicIds } }, select: { id: true, subjectId: true } })
        : [];
      const topicsBySubject = new Map<string, string[]>();
      for (const t of topics) topicsBySubject.set(t.subjectId, [...(topicsBySubject.get(t.subjectId) ?? []), t.id]);

      const buckets: Bucket[] = [];
      for (const subjectId of preference!.subjectIds) {
        buckets.push({ name: subjectId, weight: 1, filter: await this.resolvePreferredFilter({ subjectIds: [subjectId], topicIds: [] }) });
      }
      for (const [subjectId, topicIds] of topicsBySubject) {
        if (preference!.subjectIds.includes(subjectId)) continue; // the whole subject is already in
        buckets.push({ name: subjectId, weight: 1, filter: await this.resolvePreferredFilter({ subjectIds: [], topicIds }) });
      }
      return buckets;
    }

    if (!subCategoryId) return null;
    const subjects = await prisma.syllabusSubject.findMany({
      where: { subCategoryId },
      select: { id: true, name: true, linkedSubjectIds: true, practiceWeight: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const buckets: Bucket[] = subjects
      .filter((s) => (s.practiceWeight ?? 1) > 0)
      .map((s) => ({
        name: s.name,
        weight: s.practiceWeight ?? 1,
        filter: {
          OR: [
            { syllabusTopic: { subjectId: s.id } },
            ...(s.linkedSubjectIds.length > 0 ? [{ subjectId: { in: s.linkedSubjectIds } }] : []),
          ],
        },
      }));
    return buckets.length > 0 ? buckets : null;
  }

  async buildSessionQuestionIds(
    userId: string,
    mode: QuizMode,
    sessionSize: number,
    language: Language,
    taxonomyFilter: Prisma.QuestionWhereInput,
    preference: SubjectTopicPreference = null,
    subCategoryId: string | null = null,
  ): Promise<string[]> {
    const settings = await prisma.platformSettings.findUniqueOrThrow({
      where: { id: 'singleton' },
    });

    const difficulties = this.difficultiesForMode(mode);
    const caCap = this.currentAffairsCapFor(sessionSize, settings);
    const selected: string[] = [];
    const used = new Set<string>();
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
          AND: [
            {
              status: 'PUBLISHED',
              ...NOT_PENDING_AUDIT_REVIEW,
              category: QuestionCategory.CURRENT_AFFAIRS,
              difficulty: { in: difficulties },
              language,
              relevanceDate: { gte: recencyThreshold },
              history: { none: { userId } },
            },
            taxonomyFilter,
            ...(preferredFilter ? [preferredFilter] : []),
          ],
        },
        take: caCap,
        orderBy: { relevanceDate: 'desc' },
      });
      for (const q of caQuestions) {
        selected.push(q.id);
        used.add(q.id);
      }
    }

    let remaining = sessionSize - selected.length;
    if (remaining <= 0) return shuffleInPlace(selected);

    const common: Prisma.QuestionWhereInput = {
      status: 'PUBLISHED',
      ...NOT_PENDING_AUDIT_REVIEW,
      language,
      history: { none: { userId } },
    };
    const buckets = (await this.buildBuckets(preference, subCategoryId)) ?? [
      { name: 'all', weight: 1, filter: {} as Prisma.QuestionWhereInput },
    ];

    // Pass 1: the mode's difficulty. Pass 2: any difficulty — the ONLY
    // thing broadened. The subject/topic preference stays a hard boundary.
    for (const withDifficulty of [true, false]) {
      if (remaining <= 0) break;
      const baseWhere: Prisma.QuestionWhereInput[] = [
        common,
        taxonomyFilter,
        ...(withDifficulty ? [{ difficulty: { in: difficulties } }] : []),
      ];
      const picked = await this.drawFromBuckets(buckets, baseWhere, remaining, used);
      selected.push(...picked);
      remaining -= picked.length;
    }

    // No preference: if the subject buckets (e.g. a question tagged with an
    // unlisted subject name) could not fill the session, top up from the
    // rest of the exam's pool.
    if (remaining > 0 && !hasPreference) {
      const picked = await this.drawFromBuckets(
        [{ name: 'all', weight: 1, filter: {} }],
        [common, taxonomyFilter],
        remaining,
        used,
      );
      selected.push(...picked);
    }

    return shuffleInPlace(selected);
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
