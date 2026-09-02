// Question Service — implements §7.1 (Question Management): add/edit/disable,
// publish/unpublish, exact-duplicate detection on create/edit.
//
// Classification uses the 3-level Authority → Category → Sub-Category
// taxonomy (see exam-taxonomy.service.ts) plus Source Type metadata — see
// the schema comments for why each field is optional.

import { PrismaClient, QuestionStatus, Difficulty, Language, QuestionCategory, CorrectOption, SourceType } from '@prisma/client';
import { computeContentHash } from '../../common/content-hash';

const prisma = new PrismaClient();

/** Thrown by setStatus() when publishing a question with no Difficulty set — see the comment there. */
export class NoDifficultySetError extends Error {
  constructor(questionId: string) {
    super(`Question ${questionId} has no Difficulty set — set a Difficulty before publishing (it will never appear in a student quiz otherwise).`);
  }
}

export interface QuestionInput {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: CorrectOption;
  language: Language;
  authorityId?: string;
  categoryId?: string;
  subCategoryId?: string;
  examName?: string;
  examYear?: number;
  // Typed freely on the form with autocomplete suggestions; resolved to a
  // Subject row (find-or-create by name) inside create()/confirmImport()
  // rather than requiring a pre-existing subjectId.
  subjectName?: string;
  sourceType?: SourceType;
  sourceName?: string;
  internalNotes?: string;
  difficulty?: Difficulty;
  category?: QuestionCategory;
  relevanceDate?: Date;
  sourceBatchId?: string;
}

export class QuestionService {
  /**
   * Finds a Subject by name (case-sensitive exact match, trimmed) or
   * creates it — this is what lets the Bulk Upload / Add Question forms
   * offer a free-type-with-suggestions field instead of requiring a
   * separate "add a Subject" admin step first.
   */
  private async resolveSubjectId(subjectName: string | undefined): Promise<string | undefined> {
    const name = subjectName?.trim();
    if (!name) return undefined;
    const subject = await prisma.subject.upsert({ where: { name }, create: { name }, update: {} });
    return subject.id;
  }

  /** Full Subject list, for the Bulk Upload / Add Question forms' autocomplete. */
  async listSubjects() {
    return prisma.subject.findMany({ orderBy: { name: 'asc' } });
  }

  /**
   * Checks for an existing exact-duplicate (same content hash, same language).
   * Returns the duplicate's id if found, otherwise null. Callers decide
   * whether to block or just flag — bulk upload flags for review (§7.1),
   * single add/edit blocks outright since there's a human in the loop already.
   */
  async findDuplicate(input: QuestionInput): Promise<string | null> {
    const contentHash = computeContentHash(input);
    const existing = await prisma.question.findFirst({
      where: { contentHash, language: input.language },
      select: { id: true },
    });
    return existing?.id ?? null;
  }

  async create(input: QuestionInput, opts?: { allowDuplicate?: boolean }) {
    // Strip stray NUL bytes — Postgres text columns reject them outright
    // ("invalid byte sequence for encoding UTF8: 0x00"), which otherwise
    // surfaces as an opaque 500 rather than a clear validation message.
    // Bulk upload sanitizes at CSV-parse time; this covers the single
    // Add Question form (pasted text can carry the same stray byte).
    input = {
      ...input,
      questionText: input.questionText.replace(/\u0000/g, ''),
      optionA: input.optionA.replace(/\u0000/g, ''),
      optionB: input.optionB.replace(/\u0000/g, ''),
      optionC: input.optionC.replace(/\u0000/g, ''),
      optionD: input.optionD.replace(/\u0000/g, ''),
      examName: input.examName?.replace(/\u0000/g, ''),
      sourceName: input.sourceName?.replace(/\u0000/g, ''),
      subjectName: input.subjectName?.replace(/\u0000/g, ''),
      internalNotes: input.internalNotes?.replace(/\u0000/g, ''),
    };

    const contentHash = computeContentHash(input);

    if (!opts?.allowDuplicate) {
      const dup = await this.findDuplicate(input);
      if (dup) {
        throw new Error(`Duplicate question detected (existing id: ${dup})`);
      }
    }

    const subjectId = await this.resolveSubjectId(input.subjectName);

    return prisma.question.create({
      data: {
        questionText: input.questionText,
        optionA: input.optionA,
        optionB: input.optionB,
        optionC: input.optionC,
        optionD: input.optionD,
        correctOption: input.correctOption,
        language: input.language,
        authorityId: input.authorityId,
        categoryId: input.categoryId,
        subCategoryId: input.subCategoryId,
        examName: input.examName,
        examYear: input.examYear,
        subjectId,
        sourceType: input.sourceType ?? SourceType.ORIGINAL,
        sourceName: input.sourceName,
        internalNotes: input.internalNotes,
        difficulty: input.difficulty,
        category: input.category ?? QuestionCategory.STANDARD,
        relevanceDate: input.relevanceDate,
        sourceBatchId: input.sourceBatchId,
        status: QuestionStatus.DRAFT, // always lands as Draft; AI classification / admin promotes it (§7.3, §9)
        contentHash,
      },
    });
  }

  /**
   * Creates BOTH language versions of a question in one call, linked by a
   * shared translationGroupId — used by the admin form's bi-directional
   * translate-and-review flow, where the admin has already seen and approved
   * both languages before clicking Publish/Save. Both rows land as Draft,
   * same as a normal single-language add.
   */
  async createBilingualPair(
    ta: Omit<QuestionInput, 'language'>,
    en: Omit<QuestionInput, 'language'>,
  ): Promise<{ taId: string; enId: string }> {
    const taRecord = await this.create({ ...ta, language: Language.TA });
    const enRecord = await this.create({ ...en, language: Language.EN });

    const groupId = taRecord.id;
    await prisma.$transaction([
      prisma.question.update({ where: { id: taRecord.id }, data: { translationGroupId: groupId } }),
      prisma.question.update({ where: { id: enRecord.id }, data: { translationGroupId: groupId } }),
    ]);

    return { taId: taRecord.id, enId: enRecord.id };
  }

  async update(id: string, input: Partial<QuestionInput>) {
    const existing = await prisma.question.findUniqueOrThrow({ where: { id } });
    const merged = { ...existing, ...input } as QuestionInput;
    const contentHash = computeContentHash(merged);

    // subjectName isn't a real column (subjectId is) — resolve it the same
    // find-or-create way create() does. Left unresolved, Prisma would
    // reject the whole update with an unknown-field error the moment an
    // edit form includes a Subject field.
    const { subjectName, ...rest } = input;
    const subjectId = subjectName !== undefined ? await this.resolveSubjectId(subjectName) : undefined;

    return prisma.question.update({
      where: { id },
      data: { ...rest, ...(subjectId !== undefined ? { subjectId } : {}), contentHash, updatedAt: new Date() },
    });
  }

  async setStatus(id: string, status: QuestionStatus) {
    if (status === QuestionStatus.PUBLISHED) {
      // A question with no Difficulty is invisible to every student query
      // (they're always filtered by difficulty) — publishing one anyway
      // silently wastes the admin's work: it sits there forever looking
      // "done" while no student ever sees it. Block it here instead of
      // only warning about it after the fact in the list UI.
      const question = await prisma.question.findUniqueOrThrow({ where: { id }, select: { difficulty: true } });
      if (!question.difficulty) {
        throw new NoDifficultySetError(id);
      }
    }
    return prisma.question.update({ where: { id }, data: { status } });
  }

  /**
   * Setting a Difficulty is the admin's actual review decision (unlike AI
   * classification, which only auto-publishes above a confidence
   * threshold) — so a Draft question auto-publishes the moment a Difficulty
   * is set here, no separate "Publish" click needed. Disabled stays
   * Disabled (that's a deliberate hide, not "not yet reviewed"), and an
   * already-Published question just gets its Difficulty corrected in place.
   */
  async setDifficulty(id: string, difficulty: Difficulty) {
    const existing = await prisma.question.findUniqueOrThrow({ where: { id }, select: { status: true } });
    return prisma.question.update({
      where: { id },
      data: {
        difficulty,
        ...(existing.status === QuestionStatus.DRAFT ? { status: QuestionStatus.PUBLISHED } : {}),
      },
    });
  }

  /** Bulk-assigns one Difficulty to many questions at once — for an admin
   * who has already read each one and decided, and wants to apply that
   * decision to the group in one action instead of one dropdown at a time.
   * Same Draft -> Published auto-publish rule as setDifficulty() above,
   * applied per-row (Disabled ones are left Disabled). */
  /** Splits a large id list into Postgres-safe-sized batches — a single
   * query has a hard limit of 32767 bind variables, and any bulk admin
   * action on a large "Select all N matching this filter" selection (seen
   * in production with 50k+ ids) can exceed that in one shot. Used by
   * every bulk method below instead of a single `id: { in: ids } }` query
   * over the whole selection. */
  private chunkIds(ids: string[], size = 5000): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
    return chunks;
  }

  async bulkSetDifficulty(ids: string[], difficulty: Difficulty) {
    let count = 0;
    for (const batch of this.chunkIds(ids)) {
      const [difficultyResult] = await prisma.$transaction([
        prisma.question.updateMany({ where: { id: { in: batch } }, data: { difficulty } }),
        prisma.question.updateMany({ where: { id: { in: batch }, status: QuestionStatus.DRAFT }, data: { status: QuestionStatus.PUBLISHED } }),
      ]);
      count += difficultyResult.count;
    }
    return { count };
  }

  /**
   * Question Bank Stats (admin dashboard) — how many questions exist per
   * Authority → Category → Sub-Category, broken down by status, plus a
   * grand total row. Uses groupBy (counts computed in the database) rather
   * than loading every question row, since the bank is expected to grow
   * into the thousands as more exam papers are digitized.
   */
  async getTaxonomyStats() {
    const grouped = await prisma.question.groupBy({
      by: ['authorityId', 'categoryId', 'subCategoryId', 'status', 'language'],
      _count: { _all: true },
    });

    const [authorities, categories, subCategories]: [
      { id: string; name: string; purpose: { name: string } | null }[],
      { id: string; name: string }[],
      { id: string; name: string }[],
    ] = await Promise.all([
      prisma.examAuthority.findMany({ select: { id: true, name: true, purpose: { select: { name: true } } } }),
      prisma.examCategory.findMany({ select: { id: true, name: true } }),
      prisma.examSubCategory.findMany({ select: { id: true, name: true } }),
    ]);
    const authorityById = new Map(authorities.map((a) => [a.id, a]));
    const categoryById = new Map(categories.map((c) => [c.id, c.name]));
    const subCategoryById = new Map(subCategories.map((s) => [s.id, s.name]));

    // One row per unique (authority, category, subCategory) triple, with a
    // count per status AND per language — groupBy gives us one row per
    // (triple, status, language) combination, so we fold those together
    // here. Status and language are independent breakdowns of the same
    // `total`, not crossed with each other (a row's `ta`/`en` count is
    // regardless of status, matching how `total` is regardless of language).
    const rowsByKey = new Map<
      string,
      {
        authorityId: string | null;
        categoryId: string | null;
        subCategoryId: string | null;
        authorityName: string;
        purposeName: string;
        categoryName: string;
        subCategoryName: string;
        published: number;
        draft: number;
        disabled: number;
        ta: number;
        en: number;
        total: number;
      }
    >();

    for (const g of grouped) {
      const authority = g.authorityId ? authorityById.get(g.authorityId) : undefined;
      const key = `${g.authorityId ?? ''}|${g.categoryId ?? ''}|${g.subCategoryId ?? ''}`;
      if (!rowsByKey.has(key)) {
        rowsByKey.set(key, {
          authorityId: g.authorityId ?? null,
          categoryId: g.categoryId ?? null,
          subCategoryId: g.subCategoryId ?? null,
          authorityName: authority?.name ?? '(no authority)',
          purposeName: authority?.purpose?.name ?? '',
          categoryName: g.categoryId ? (categoryById.get(g.categoryId) ?? '(unknown)') : '—',
          subCategoryName: g.subCategoryId ? (subCategoryById.get(g.subCategoryId) ?? '(unknown)') : '—',
          published: 0,
          draft: 0,
          disabled: 0,
          ta: 0,
          en: 0,
          total: 0,
        });
      }
      const row = rowsByKey.get(key)!;
      const count = g._count._all;
      if (g.status === QuestionStatus.PUBLISHED) row.published += count;
      else if (g.status === QuestionStatus.DRAFT) row.draft += count;
      else if (g.status === QuestionStatus.DISABLED) row.disabled += count;
      if (g.language === Language.TA) row.ta += count;
      else if (g.language === Language.EN) row.en += count;
      row.total += count;
    }

    const rows = [...rowsByKey.values()].sort((a, b) => a.authorityName.localeCompare(b.authorityName) || a.categoryName.localeCompare(b.categoryName) || a.subCategoryName.localeCompare(b.subCategoryName));

    const grandTotal = rows.reduce(
      (acc, r) => ({
        published: acc.published + r.published,
        draft: acc.draft + r.draft,
        disabled: acc.disabled + r.disabled,
        ta: acc.ta + r.ta,
        en: acc.en + r.en,
        total: acc.total + r.total,
      }),
      { published: 0, draft: 0, disabled: 0, ta: 0, en: 0, total: 0 },
    );

    // Per-authority totals too — this is what the bar chart plots.
    const byAuthority = new Map<string, number>();
    for (const r of rows) byAuthority.set(r.authorityName, (byAuthority.get(r.authorityName) ?? 0) + r.total);
    const authorityTotals = [...byAuthority.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

    return { rows, grandTotal, authorityTotals };
  }

  /** Shared filter → Prisma `where` builder for both list() and listIds(), so
   * "Select All Matching Filter" always matches exactly what's on screen. */
  // A stats-table row can represent "(no category)" / "(no authority)" —
  // categoryId/authorityId genuinely NULL in the database, not merely
  // unfiltered. The Stats page's links send the sentinel '__none__' for
  // exactly that case (see stats/page.tsx) — distinct from the field being
  // absent entirely, which means "don't filter on this at all" (the normal
  // admin dropdown behavior, unchanged).
  private static readonly NONE = '__none__';
  private resolveFilterId(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    return value === QuestionService.NONE ? null : value;
  }

  private buildWhere(filters: {
    status?: QuestionStatus;
    difficulty?: Difficulty;
    authorityId?: string;
    categoryId?: string;
    subCategoryId?: string;
    category?: QuestionCategory;
    language?: Language;
    search?: string;
    noDifficultyOnly?: boolean;
  }) {
    return {
      status: filters.noDifficultyOnly ? undefined : filters.status,
      difficulty: filters.noDifficultyOnly ? null : filters.difficulty,
      authorityId: this.resolveFilterId(filters.authorityId),
      categoryId: this.resolveFilterId(filters.categoryId),
      subCategoryId: this.resolveFilterId(filters.subCategoryId),
      category: filters.category,
      language: filters.language,
      ...(filters.search ? { questionText: { contains: filters.search, mode: 'insensitive' as const } } : {}),
    };
  }

  async list(filters: {
    status?: QuestionStatus;
    difficulty?: Difficulty;
    authorityId?: string;
    categoryId?: string;
    subCategoryId?: string;
    category?: QuestionCategory;
    language?: Language;
    search?: string; // matches question text, case-insensitive substring
    // "Waiting for AI" tab — every question with no Difficulty yet,
    // regardless of status (Draft/Published/Disabled all included, since a
    // Published-with-no-Difficulty row is the exact broken state the admin
    // needs to find and fix). Overrides `status` and `difficulty` above.
    noDifficultyOnly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = this.buildWhere(filters);

    const [items, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { authority: true, examCategory: true, subCategory: true, subject: { select: { name: true } } },
      }),
      prisma.question.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** Every question id matching the current filter — regardless of page —
   * for the "Select All (N) Matching Filter" bulk-select action. IDs only
   * (not full rows), so this stays cheap even for a large matching set. */
  async listIds(filters: {
    status?: QuestionStatus;
    difficulty?: Difficulty;
    authorityId?: string;
    categoryId?: string;
    subCategoryId?: string;
    category?: QuestionCategory;
    language?: Language;
    search?: string;
    noDifficultyOnly?: boolean;
  }) {
    const where = this.buildWhere(filters);
    const rows = await prisma.question.findMany({ where, select: { id: true } });
    return rows.map((r) => r.id);
  }

  /** Bulk actions for the admin panel's "select multiple, act once" flow. */
  async bulkSetStatus(ids: string[], status: QuestionStatus) {
    if (status === QuestionStatus.PUBLISHED) {
      // Same rule as setStatus() above, applied per-row rather than
      // rejecting the whole batch — the admin selected a mix of ready and
      // not-yet-classified questions all the time (e.g. right after a bulk
      // upload), and losing the valid ones because a few weren't classified
      // yet would be worse than just reporting which ones were skipped.
      let eligibleIds: string[] = [];
      for (const batch of this.chunkIds(ids)) {
        const eligible = await prisma.question.findMany({
          where: { id: { in: batch }, difficulty: { not: null } },
          select: { id: true },
        });
        eligibleIds = eligibleIds.concat(eligible.map((q) => q.id));
      }
      let count = 0;
      for (const batch of this.chunkIds(eligibleIds)) {
        const result = await prisma.question.updateMany({ where: { id: { in: batch } }, data: { status } });
        count += result.count;
      }
      return { count, skippedNoDifficulty: ids.length - eligibleIds.length };
    }
    let count = 0;
    for (const batch of this.chunkIds(ids)) {
      const result = await prisma.question.updateMany({ where: { id: { in: batch } }, data: { status } });
      count += result.count;
    }
    return { count, skippedNoDifficulty: 0 };
  }

  /**
   * Deletes questions the student has never answered (safe — no other table
   * references them). For questions that DO have answer history, hard-
   * deleting would violate a foreign-key constraint (Postgres RESTRICT) and
   * would also silently corrupt that student's stats — so those are
   * DISABLED instead, which removes them from any future quiz without
   * touching already-recorded history.
   */
  async bulkDelete(ids: string[]) {
    let referencedIds = new Set<string>();
    for (const batch of this.chunkIds(ids)) {
      const [withHistory, withSessionRefs] = await Promise.all([
        prisma.userQuestionHistory.findMany({ where: { questionId: { in: batch } }, select: { questionId: true }, distinct: ['questionId'] }),
        prisma.quizSessionQuestion.findMany({ where: { questionId: { in: batch } }, select: { questionId: true }, distinct: ['questionId'] }),
      ]);
      for (const h of withHistory) referencedIds.add(h.questionId);
      for (const s of withSessionRefs) referencedIds.add(s.questionId);
    }

    const safeToDelete = ids.filter((id) => !referencedIds.has(id));
    const mustDisableInstead = ids.filter((id) => referencedIds.has(id));

    let deletedCount = 0;
    for (const batch of this.chunkIds(safeToDelete)) {
      const result = await prisma.question.deleteMany({ where: { id: { in: batch } } });
      deletedCount += result.count;
    }
    for (const batch of this.chunkIds(mustDisableInstead)) {
      await prisma.question.updateMany({ where: { id: { in: batch } }, data: { status: QuestionStatus.DISABLED } });
    }

    return { count: deletedCount, disabledInstead: mustDisableInstead.length };
  }

  /**
   * Permanently deletes questions REGARDLESS of answer history — deletes the
   * history/session references first, then the question. This is a QA/launch-
   * prep tool only (Super Admin, extra confirmation in the UI): using this on
   * questions real students have answered corrupts their recorded stats.
   * Never call this from any student-facing or automated path.
   */
  async forceBulkDelete(ids: string[]) {
    for (const batch of this.chunkIds(ids)) {
      await prisma.$transaction([
        prisma.userQuestionHistory.deleteMany({ where: { questionId: { in: batch } } }),
        prisma.quizSessionQuestion.deleteMany({ where: { questionId: { in: batch } } }),
        prisma.question.deleteMany({ where: { id: { in: batch } } }),
      ]);
    }
    return { count: ids.length };
  }

  /** Quick-entry for Current Affairs, per §7.2 — minimal required fields. */
  async createCurrentAffairs(input: {
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: CorrectOption;
    language: Language;
    publish?: boolean;
  }) {
    const contentHash = computeContentHash(input);
    return prisma.question.create({
      data: {
        ...input,
        category: QuestionCategory.CURRENT_AFFAIRS,
        relevanceDate: new Date(),
        difficulty: Difficulty.MEDIUM, // sensible default, editable later per §7.2
        status: input.publish ? QuestionStatus.PUBLISHED : QuestionStatus.DRAFT,
        sourceType: SourceType.ORIGINAL,
        contentHash,
      },
    });
  }

  /**
   * One-time heuristic Difficulty assignment (agreed rule) — a stopgap for
   * a large no-Difficulty backlog when AI classification is too slow/
   * rate-limited to keep up. NOT a replacement for real classification:
   * a question with a calculation signal (numbers+units, "calculate",
   * "கணக்கிடுக", a LaTeX-style formula) is HARD regardless of length;
   * otherwise length alone decides (>120 chars = HARD, else MEDIUM).
   * Never touches a question that already has a Difficulty set, and never
   * changes status — publishing stays a separate, deliberate admin action.
   */
  private heuristicDifficulty(text: string): Difficulty {
    const calcSignal =
      /\d+(\.\d+)?\s*(m\/s|°c|kg|km|cm|mm|m\^?2|m³|pa|n\/m|mol|g\/mol)|\$[^$]+\$|\\times|\\frac|calculate|compute|கணக்கிடு|find the value|determine the/i;
    if (calcSignal.test(text)) return Difficulty.HARD;
    return text.length > 120 ? Difficulty.HARD : Difficulty.MEDIUM;
  }

  /** Dry run — counts what WOULD happen, writes nothing. */
  async previewHeuristicClassification() {
    const rows = await prisma.question.findMany({ where: { difficulty: null }, select: { questionText: true } });
    let medium = 0;
    let hard = 0;
    for (const r of rows) {
      if (this.heuristicDifficulty(r.questionText) === Difficulty.HARD) hard++;
      else medium++;
    }
    return { total: rows.length, medium, hard };
  }

  /** Actually applies the rule — Difficulty only, status untouched. */
  /** Chunks a large id list into Postgres-safe-sized updateMany batches —
   * a single query has a hard limit of 32767 bind variables, and a
   * ~50k-question backlog easily produces more ids than that in one shot
   * (hit exactly this in production: 38803 vs the 32767 limit). */
  private async updateManyInBatches(ids: string[], difficulty: Difficulty, batchSize = 5000) {
    let count = 0;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const result = await prisma.question.updateMany({ where: { id: { in: batch } }, data: { difficulty } });
      count += result.count;
    }
    return count;
  }

  async applyHeuristicClassification() {
    const rows = await prisma.question.findMany({ where: { difficulty: null }, select: { id: true, questionText: true } });
    const mediumIds: string[] = [];
    const hardIds: string[] = [];
    for (const r of rows) {
      (this.heuristicDifficulty(r.questionText) === Difficulty.HARD ? hardIds : mediumIds).push(r.id);
    }
    const [medium, hard] = await Promise.all([
      this.updateManyInBatches(mediumIds, Difficulty.MEDIUM),
      this.updateManyInBatches(hardIds, Difficulty.HARD),
    ]);
    return { medium, hard };
  }
}
