// Bulk Upload Service — implements §6.3 (Bulk Upload) and §7.1 (Bulk Excel/CSV
// upload with validation and duplicate detection).
//
// Flow: parse rows → validate each row → check for duplicates (existing DB +
// within the same file) → insert valid/non-duplicate rows as Draft → return a
// per-row report so the admin sees exactly what happened to every row.

import { PrismaClient, Language, CorrectOption, QuestionStatus, QuestionCategory } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { computeContentHash } from '../../common/content-hash';

const prisma = new PrismaClient();

export interface BulkRow {
  rowNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  examType?: string;
  examSubType?: string;
  language?: string;
}

export type RowResult =
  | { rowNumber: number; status: 'inserted'; questionId: string }
  | { rowNumber: number; status: 'duplicate'; existingQuestionId?: string; reason: string }
  | { rowNumber: number; status: 'invalid'; reason: string };

export class BulkUploadService {
  /**
   * Expected CSV columns (header row required):
   * question, option_a, option_b, option_c, option_d, correct_answer,
   * exam_type (optional), exam_sub_type (optional), language (optional, defaults to 'ta')
   */
  async processCsv(csvContent: string, uploadedBy: string): Promise<{ batchId: string; results: RowResult[] }> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rawRows: Record<string, string>[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const results: RowResult[] = [];
    const seenHashesInFile = new Map<string, number>(); // contentHash -> first rowNumber seen

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2; // account for header row, 1-indexed
      const raw = rawRows[i];

      // ── Validation ──────────────────────────────────────────────
      const missing = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'].filter(
        (col) => !raw[col] || raw[col].trim() === '',
      );
      if (missing.length > 0) {
        results.push({ rowNumber, status: 'invalid', reason: `Missing fields: ${missing.join(', ')}` });
        continue;
      }

      const correctAnswer = raw.correct_answer.trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
        results.push({
          rowNumber,
          status: 'invalid',
          reason: `correct_answer must be A/B/C/D, got "${raw.correct_answer}"`,
        });
        continue;
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

      // ── Duplicate check: within this same file ─────────────────
      if (seenHashesInFile.has(contentHash)) {
        results.push({
          rowNumber,
          status: 'duplicate',
          reason: `Duplicate of row ${seenHashesInFile.get(contentHash)} within this upload`,
        });
        continue;
      }

      // ── Duplicate check: against existing published/draft questions ─────
      const existing = await prisma.question.findFirst({
        where: { contentHash, language },
        select: { id: true },
      });
      if (existing) {
        results.push({
          rowNumber,
          status: 'duplicate',
          existingQuestionId: existing.id,
          reason: 'Matches an existing question in the bank',
        });
        continue;
      }

      // ── Resolve exam type / sub-type by name (create if new) ────
      let examTypeId: string | undefined;
      let examSubTypeId: string | undefined;
      if (raw.exam_type?.trim()) {
        const examType = await prisma.examType.upsert({
          where: { name: raw.exam_type.trim() },
          create: { name: raw.exam_type.trim() },
          update: {},
        });
        examTypeId = examType.id;

        if (raw.exam_sub_type?.trim()) {
          const examSubType = await prisma.examSubType.upsert({
            where: { examTypeId_name: { examTypeId: examType.id, name: raw.exam_sub_type.trim() } },
            create: { examTypeId: examType.id, name: raw.exam_sub_type.trim() },
            update: {},
          });
          examSubTypeId = examSubType.id;
        }
      }

      // ── Insert as Draft — AI classification picks it up next (§9) ────
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
        },
      });

      seenHashesInFile.set(contentHash, rowNumber);
      results.push({ rowNumber, status: 'inserted', questionId: created.id });
    }

    return { batchId, results };
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
