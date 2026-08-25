// Question Service — implements §7.1 (Question Management): add/edit/disable,
// publish/unpublish, exact-duplicate detection on create/edit.
//
// Classification uses the 3-level Authority → Category → Sub-Category
// taxonomy (see exam-taxonomy.service.ts) plus Source Type metadata — see
// the schema comments for why each field is optional.

import { PrismaClient, QuestionStatus, Difficulty, Language, QuestionCategory, CorrectOption, SourceType } from '@prisma/client';
import { computeContentHash } from '../../common/content-hash';

const prisma = new PrismaClient();

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
    const contentHash = computeContentHash(input);

    if (!opts?.allowDuplicate) {
      const dup = await this.findDuplicate(input);
      if (dup) {
        throw new Error(`Duplicate question detected (existing id: ${dup})`);
      }
    }

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

    return prisma.question.update({
      where: { id },
      data: { ...input, contentHash, updatedAt: new Date() },
    });
  }

  async setStatus(id: string, status: QuestionStatus) {
    return prisma.question.update({ where: { id }, data: { status } });
  }

  async setDifficulty(id: string, difficulty: Difficulty) {
    return prisma.question.update({ where: { id }, data: { difficulty } });
  }

  async list(filters: {
    status?: QuestionStatus;
    difficulty?: Difficulty;
    authorityId?: string;
    categoryId?: string;
    category?: QuestionCategory;
    language?: Language;
    search?: string; // matches question text, case-insensitive substring
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;

    const where = {
      status: filters.status,
      difficulty: filters.difficulty,
      authorityId: filters.authorityId,
      categoryId: filters.categoryId,
      category: filters.category,
      language: filters.language,
      ...(filters.search ? { questionText: { contains: filters.search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { authority: true, examCategory: true, subCategory: true },
      }),
      prisma.question.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /** Bulk actions for the admin panel's "select multiple, act once" flow. */
  async bulkSetStatus(ids: string[], status: QuestionStatus) {
    const result = await prisma.question.updateMany({ where: { id: { in: ids } }, data: { status } });
    return { count: result.count };
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
    const withHistory = await prisma.userQuestionHistory.findMany({
      where: { questionId: { in: ids } },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    const withSessionRefs = await prisma.quizSessionQuestion.findMany({
      where: { questionId: { in: ids } },
      select: { questionId: true },
      distinct: ['questionId'],
    });
    const referencedIds = new Set([...withHistory.map((h) => h.questionId), ...withSessionRefs.map((s) => s.questionId)]);

    const safeToDelete = ids.filter((id) => !referencedIds.has(id));
    const mustDisableInstead = ids.filter((id) => referencedIds.has(id));

    const [deleted] = await Promise.all([
      safeToDelete.length > 0 ? prisma.question.deleteMany({ where: { id: { in: safeToDelete } } }) : { count: 0 },
      mustDisableInstead.length > 0
        ? prisma.question.updateMany({ where: { id: { in: mustDisableInstead } }, data: { status: QuestionStatus.DISABLED } })
        : Promise.resolve(),
    ]);

    return { count: deleted.count, disabledInstead: mustDisableInstead.length };
  }

  /**
   * Permanently deletes questions REGARDLESS of answer history — deletes the
   * history/session references first, then the question. This is a QA/launch-
   * prep tool only (Super Admin, extra confirmation in the UI): using this on
   * questions real students have answered corrupts their recorded stats.
   * Never call this from any student-facing or automated path.
   */
  async forceBulkDelete(ids: string[]) {
    await prisma.$transaction([
      prisma.userQuestionHistory.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.quizSessionQuestion.deleteMany({ where: { questionId: { in: ids } } }),
      prisma.question.deleteMany({ where: { id: { in: ids } } }),
    ]);
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
}
