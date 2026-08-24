// Question Service — implements §7.1 (Question Management): add/edit/disable,
// publish/unpublish, exact-duplicate detection on create/edit.

import { PrismaClient, QuestionStatus, Difficulty, Language, QuestionCategory, CorrectOption } from '@prisma/client';
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
  examTypeId?: string;
  examSubTypeId?: string;
  difficulty?: Difficulty;
  category?: QuestionCategory;
  relevanceDate?: Date;
  sourceBatchId?: string;
  examYear?: number;
  isPreviousYearQuestion?: boolean;
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
        examTypeId: input.examTypeId,
        examSubTypeId: input.examSubTypeId,
        difficulty: input.difficulty,
        category: input.category ?? QuestionCategory.STANDARD,
        relevanceDate: input.relevanceDate,
        sourceBatchId: input.sourceBatchId,
        examYear: input.examYear,
        isPreviousYearQuestion: input.isPreviousYearQuestion ?? false,
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
    examTypeId?: string;
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
      examTypeId: filters.examTypeId,
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
        include: { examType: true, examSubType: true },
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

  async bulkDelete(ids: string[]) {
    const result = await prisma.question.deleteMany({ where: { id: { in: ids } } });
    return { count: result.count };
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
        contentHash,
      },
    });
  }
}
