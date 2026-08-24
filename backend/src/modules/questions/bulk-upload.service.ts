// Bulk Upload Service — implements §6.3 (Bulk Upload) and §7.1 (Bulk Excel/CSV
// upload with validation and duplicate detection), extended to support two
// CSV shapes:
//
//   Format A (single-language, original): question, option_a..d,
//     correct_answer, exam_type, exam_sub_type, language. The missing
//     language is generated automatically afterward via Gemini translation
//     (queued as linked Draft rows — an admin still reviews before publish).
//
//   Format B (bilingual — e.g. a source PDF that already had both languages,
//     so no AI translation is needed or wanted): question_ta, question_en,
//     option_a_ta, option_a_en, ... option_d_ta, option_d_en, correct_answer,
//     exam_type, exam_sub_type. Both language rows are inserted directly from
//     the file's own data — faster and more accurate than round-tripping
//     through AI when the translation already exists.
//
// Both formats accept an optional `exam_year` column (§ previous-year-question
// metadata — admin-panel-only for now, not yet surfaced to students).
//
// Flow: parse rows → detect format → validate → duplicate-check (existing DB
// + within the same file) → insert as Draft → return a per-row report.

import { PrismaClient, Language, CorrectOption, QuestionStatus, QuestionCategory } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { computeContentHash } from '../../common/content-hash';
import { TranslationService } from './translation.service';

const prisma = new PrismaClient();
const translationService = new TranslationService();

export type RowResult =
  | { rowNumber: number; status: 'inserted'; questionId: string; questionText: string; secondLanguageQueued?: boolean; note?: string }
  | { rowNumber: number; status: 'duplicate'; existingQuestionId?: string; reason: string }
  | { rowNumber: number; status: 'invalid'; reason: string };

/** Batch-wide defaults, set once by the admin before upload, applied to every
 * row that doesn't specify its own exam_type/exam_sub_type/exam_year column —
 * saves repeating the same exam metadata on every line of a single-exam CSV. */
export interface BatchDefaults {
  examType?: string;
  examSubType?: string;
  examYear?: number;
}

export class BulkUploadService {
  async processCsv(csvContent: string, uploadedBy: string, batchDefaults: BatchDefaults = {}): Promise<{ batchId: string; results: RowResult[] }> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rawRows: Record<string, string>[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const isBilingualFormat = rawRows.length > 0 && ('question_ta' in rawRows[0] || 'question_en' in rawRows[0]);

    const results: RowResult[] = [];
    const seenHashesInFile = new Map<string, number>();
    const idsNeedingTranslation: string[] = []; // Format A rows only — translated in a paced pass after insertion

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2;
      // Row-level exam_type/exam_sub_type/exam_year win if present; otherwise
      // fall back to the batch-wide defaults the admin set before uploading.
      const raw = {
        ...rawRows[i],
        exam_type: rawRows[i].exam_type?.trim() || batchDefaults.examType || '',
        exam_sub_type: rawRows[i].exam_sub_type?.trim() || batchDefaults.examSubType || '',
      };

      const examYear = raw.exam_year?.trim()
        ? parseInt(raw.exam_year.trim(), 10)
        : batchDefaults.examYear;

      if (isBilingualFormat) {
        const outcome = await this.processBilingualRow(raw, rowNumber, batchId, examYear, seenHashesInFile);
        results.push(outcome);
      } else {
        const outcome = await this.processSingleLanguageRow(raw, rowNumber, batchId, examYear, seenHashesInFile);
        results.push(outcome);
        if (outcome.status === 'inserted' && outcome.secondLanguageQueued) {
          idsNeedingTranslation.push(outcome.questionId);
        }
      }
    }

    // Fire-and-forget: generate the missing-language translations in the
    // background, same pacing approach as AI classification, so the upload
    // response returns immediately.
    if (idsNeedingTranslation.length > 0) {
      this.translateQueuedRows(idsNeedingTranslation).catch((err) =>
        console.error(`Background translation failed for batch ${batchId}:`, err),
      );
    }

    return { batchId, results };
  }

  private async translateQueuedRows(ids: string[]) {
    for (const id of ids) {
      try {
        await translationService.createMissingTranslation(id);
      } catch (err) {
        console.error(`Translation failed for question ${id}:`, err);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  private async resolveExamTaxonomy(examTypeName?: string, examSubTypeName?: string) {
    let examTypeId: string | undefined;
    let examSubTypeId: string | undefined;
    if (examTypeName?.trim()) {
      const examType = await prisma.examType.upsert({
        where: { name: examTypeName.trim() },
        create: { name: examTypeName.trim() },
        update: {},
      });
      examTypeId = examType.id;

      if (examSubTypeName?.trim()) {
        const examSubType = await prisma.examSubType.upsert({
          where: { examTypeId_name: { examTypeId: examType.id, name: examSubTypeName.trim() } },
          create: { examTypeId: examType.id, name: examSubTypeName.trim() },
          update: {},
        });
        examSubTypeId = examSubType.id;
      }
    }
    return { examTypeId, examSubTypeId };
  }

  private async processSingleLanguageRow(
    raw: Record<string, string>,
    rowNumber: number,
    batchId: string,
    examYear: number | undefined,
    seenHashesInFile: Map<string, number>,
  ): Promise<RowResult> {
    const missing = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'].filter(
      (col) => !raw[col] || raw[col].trim() === '',
    );
    if (missing.length > 0) {
      return { rowNumber, status: 'invalid', reason: `Missing fields: ${missing.join(', ')}` };
    }

    const correctAnswer = raw.correct_answer.trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return { rowNumber, status: 'invalid', reason: `correct_answer must be A/B/C/D, got "${raw.correct_answer}"` };
    }

    const language: Language = raw.language?.trim().toLowerCase() === 'en' ? Language.EN : Language.TA;
    const fields = {
      questionText: raw.question.trim(),
      optionA: raw.option_a.trim(),
      optionB: raw.option_b.trim(),
      optionC: raw.option_c.trim(),
      optionD: raw.option_d.trim(),
    };
    const contentHash = computeContentHash(fields);

    if (seenHashesInFile.has(contentHash)) {
      return { rowNumber, status: 'duplicate', reason: `Duplicate of row ${seenHashesInFile.get(contentHash)} within this upload` };
    }
    const existing = await prisma.question.findFirst({ where: { contentHash, language }, select: { id: true } });
    if (existing) {
      return { rowNumber, status: 'duplicate', existingQuestionId: existing.id, reason: 'Matches an existing question in the bank' };
    }

    const { examTypeId, examSubTypeId } = await this.resolveExamTaxonomy(raw.exam_type, raw.exam_sub_type);

    const created = await prisma.question.create({
      data: {
        ...fields,
        correctOption: correctAnswer as CorrectOption,
        language,
        examTypeId,
        examSubTypeId,
        category: QuestionCategory.STANDARD,
        status: QuestionStatus.DRAFT,
        contentHash,
        sourceBatchId: batchId,
        examYear,
      },
    });

    seenHashesInFile.set(contentHash, rowNumber);
    return { rowNumber, status: 'inserted', questionId: created.id, questionText: fields.questionText, secondLanguageQueued: true };
  }

  private async processBilingualRow(
    raw: Record<string, string>,
    rowNumber: number,
    batchId: string,
    examYear: number | undefined,
    seenHashesInFile: Map<string, number>,
  ): Promise<RowResult> {
    const correctAnswer = raw.correct_answer?.trim().toUpperCase();
    if (!correctAnswer || !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return { rowNumber, status: 'invalid', reason: `correct_answer must be A/B/C/D, got "${raw.correct_answer}"` };
    }

    const hasTa = !!raw.question_ta?.trim();
    const hasEn = !!raw.question_en?.trim();
    if (!hasTa && !hasEn) {
      return { rowNumber, status: 'invalid', reason: 'Neither question_ta nor question_en provided' };
    }

    const { examTypeId, examSubTypeId } = await this.resolveExamTaxonomy(raw.exam_type, raw.exam_sub_type);
    let firstId: string | null = null;
    let firstText: string | null = null;
    let groupId: string | null = null;
    const skippedLanguages: string[] = []; // languages that were duplicates — noted, but don't block the other language

    if (hasTa) {
      const result = await this.insertOneLanguageRow(
        raw, 'ta', Language.TA, correctAnswer as CorrectOption, examTypeId, examSubTypeId,
        batchId, examYear, seenHashesInFile, rowNumber, groupId,
      );
      if ('error' in result) {
        // A duplicate in one language doesn't block inserting the other —
        // only a genuinely invalid row (missing options) is fatal to the row.
        if (result.error.status === 'invalid') return result.error;
        skippedLanguages.push('TA');
      } else {
        firstId = result.id;
        firstText = result.questionText;
        groupId = result.id;
      }
    }

    if (hasEn) {
      const result = await this.insertOneLanguageRow(
        raw, 'en', Language.EN, correctAnswer as CorrectOption, examTypeId, examSubTypeId,
        batchId, examYear, seenHashesInFile, rowNumber, groupId,
      );
      if ('error' in result) {
        if (result.error.status === 'invalid') return result.error;
        skippedLanguages.push('EN');
      } else {
        if (!firstId) { firstId = result.id; firstText = result.questionText; }
        if (!groupId) groupId = result.id;
      }
    }

    if (!firstId) {
      // Both languages were duplicates — the whole row is a no-op.
      return { rowNumber, status: 'duplicate', reason: 'Both language versions already exist in the bank' };
    }

    return {
      rowNumber,
      status: 'inserted',
      questionId: firstId,
      questionText: firstText!,
      ...(skippedLanguages.length > 0 ? { note: `${skippedLanguages.join(', ')} version already existed — only the other language was inserted` } : {}),
    };
  }

  /** Inserts one language's version of a bilingual-format row. Returns either the new question's id+text, or a RowResult describing why it was rejected. */
  private async insertOneLanguageRow(
    raw: Record<string, string>,
    suffix: 'ta' | 'en',
    lang: Language,
    correctOption: CorrectOption,
    examTypeId: string | undefined,
    examSubTypeId: string | undefined,
    batchId: string,
    examYear: number | undefined,
    seenHashesInFile: Map<string, number>,
    rowNumber: number,
    groupId: string | null,
  ): Promise<{ id: string; questionText: string } | { error: RowResult }> {
    const fields = {
      questionText: (raw[`question_${suffix}`] ?? '').trim(),
      optionA: (raw[`option_a_${suffix}`] ?? '').trim(),
      optionB: (raw[`option_b_${suffix}`] ?? '').trim(),
      optionC: (raw[`option_c_${suffix}`] ?? '').trim(),
      optionD: (raw[`option_d_${suffix}`] ?? '').trim(),
    };
    if (!fields.optionA || !fields.optionB || !fields.optionC || !fields.optionD) {
      return { error: { rowNumber, status: 'invalid', reason: `Missing option(s) for ${lang} in row ${rowNumber}` } };
    }

    const contentHash = computeContentHash(fields);
    if (seenHashesInFile.has(contentHash)) {
      return { error: { rowNumber, status: 'duplicate', reason: `Duplicate of row ${seenHashesInFile.get(contentHash)} within this upload` } };
    }
    const existing = await prisma.question.findFirst({ where: { contentHash, language: lang }, select: { id: true } });
    if (existing) {
      return { error: { rowNumber, status: 'duplicate', existingQuestionId: existing.id, reason: `${lang} version matches an existing question` } };
    }

    const created = await prisma.question.create({
      data: {
        questionText: fields.questionText,
        optionA: fields.optionA,
        optionB: fields.optionB,
        optionC: fields.optionC,
        optionD: fields.optionD,
        correctOption,
        language: lang,
        examTypeId,
        examSubTypeId,
        category: QuestionCategory.STANDARD,
        status: QuestionStatus.DRAFT,
        contentHash,
        sourceBatchId: batchId,
        examYear,
        translationGroupId: groupId ?? undefined,
      },
      select: { id: true },
    });

    if (!groupId) {
      await prisma.question.update({ where: { id: created.id }, data: { translationGroupId: created.id } });
    }

    seenHashesInFile.set(contentHash, rowNumber);
    return { id: created.id, questionText: fields.questionText };
  }

  summarize(results: RowResult[]) {
    return {
      total: results.length,
      inserted: results.filter((r) => r.status === 'inserted').length,
      duplicates: results.filter((r) => r.status === 'duplicate').length,
      invalid: results.filter((r) => r.status === 'invalid').length,
    };
  }
}
