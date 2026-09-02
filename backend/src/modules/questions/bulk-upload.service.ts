// Bulk Upload Service — implements §7.1 + the finalized Bulk Upload
// requirements: admin sets batch-wide metadata ONCE (Authority, Category,
// Sub-Category, Exam Name, Exam Year, Source Type, Source Name), then
// uploads a CSV containing only the question data itself. Every row
// inherits the batch metadata — nothing is repeated per row.
//
// Flow (two phases, matching the agreed V1 scope — exact-duplicate
// detection only, simple summary+list preview, no per-row checkboxes):
//   1. preview(csv, batchMeta) — parses + validates + exact-duplicate-checks,
//      returns a summary and per-row status. Writes NOTHING to the database.
//   2. confirmImport(rows, batchMeta) — takes the rows the admin approved
//      (the frontend only sends the ones that were valid & non-duplicate)
//      and actually inserts them as Draft, same as before.
//
// CSV columns (one format only, matching the agreed spec): question_ta,
// question_en, option_a_ta, option_a_en, option_b_ta, option_b_en,
// option_c_ta, option_c_en, option_d_ta, option_d_en, correct_answer.
// A row needs at least one language fully filled in; if only one language
// is provided, the other is generated via background translation after
// import (same translation service as the single-question form).

import { PrismaClient, Language, CorrectOption, QuestionStatus, QuestionCategory, SourceType } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { computeContentHash } from '../../common/content-hash';
import { TranslationService } from './translation.service';

const prisma = new PrismaClient();
const translationService = new TranslationService();

export interface BatchMetadata {
  authorityId?: string;
  categoryId?: string;
  subCategoryId?: string;
  examName?: string;
  examYear?: number;
  // Typed with autocomplete on the Bulk Upload form; resolved to a Subject
  // row (find-or-create) at insert time, same as the single Add Question form.
  subjectName?: string;
  sourceType: SourceType;
  sourceName?: string;
  // Original/Book/Other only (finalized requirement) — additional
  // Authorities this WHOLE batch also applies to, beyond the primary
  // authorityId above. Creates a QuestionAuthorityTag row per question per
  // additional Authority. Never used for PREVIOUS_EXAM (that source type
  // stays tied to its one paper's Authority).
  additionalAuthorityIds?: string[];
}

export interface PreviewRow {
  rowNumber: number;
  status: 'valid' | 'invalid' | 'duplicate';
  reason?: string;
  // Present when status === 'valid' — this is exactly what confirmImport needs back.
  data?: {
    questionTextTa?: string;
    questionTextEn?: string;
    optionATa?: string; optionAEn?: string;
    optionBTa?: string; optionBEn?: string;
    optionCTa?: string; optionCEn?: string;
    optionDTa?: string; optionDEn?: string;
    correctAnswer: CorrectOption;
  };
}

export class BulkUploadService {
  /** Phase 1 — parse, validate, exact-duplicate-check. Writes nothing. */
  async preview(csvContent: string): Promise<{ summary: { total: number; valid: number; invalid: number; duplicate: number }; rows: PreviewRow[] }> {
    // Strips stray NUL (0x00) bytes that sometimes end up in a CSV cell
    // after PDF-to-text extraction — Postgres text columns reject any
    // string containing one outright ("invalid byte sequence for encoding
    // UTF8: 0x00"), which otherwise surfaces as an opaque failure only at
    // Confirm Import time, well after the preview looked completely valid.
    // Stripped once here so preview and confirm always see identical text
    // (and therefore compute identical content hashes for duplicate checks).
    const sanitizedCsvContent = csvContent.replace(/\u0000/g, '');
    const rawRows: Record<string, string>[] = parse(sanitizedCsvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // strips a leading UTF-8 BOM (common in Excel/tool-exported CSVs) before header
                 // parsing — without this, a BOM silently prefixes the first column's key
                 // (e.g. "question_en" becomes "\uFEFFquestion_en"), so raw.question_en reads
                 // as undefined for every row whenever question_en is the first CSV column.
    });

    const rows: PreviewRow[] = [];
    const seenHashesInFile = new Set<string>();

    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 2;
      const raw = rawRows[i];
      rows.push(await this.validateRow(raw, rowNumber, seenHashesInFile));
    }

    return {
      summary: {
        total: rows.length,
        valid: rows.filter((r) => r.status === 'valid').length,
        invalid: rows.filter((r) => r.status === 'invalid').length,
        duplicate: rows.filter((r) => r.status === 'duplicate').length,
      },
      rows,
    };
  }

  private async validateRow(raw: Record<string, string>, rowNumber: number, seenHashesInFile: Set<string>): Promise<PreviewRow> {
    const correctAnswer = raw.correct_answer?.trim().toUpperCase();
    if (!correctAnswer || !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      return { rowNumber, status: 'invalid', reason: `correct_answer must be A/B/C/D, got "${raw.correct_answer ?? ''}"` };
    }

    const hasTa = !!raw.question_ta?.trim();
    const hasEn = !!raw.question_en?.trim();
    if (!hasTa && !hasEn) {
      return { rowNumber, status: 'invalid', reason: 'Neither question_ta nor question_en provided' };
    }

    const data: PreviewRow['data'] = { correctAnswer: correctAnswer as CorrectOption };
    const hashes: string[] = [];

    if (hasTa) {
      const fields = {
        questionText: raw.question_ta.trim(),
        optionA: raw.option_a_ta?.trim() ?? '',
        optionB: raw.option_b_ta?.trim() ?? '',
        optionC: raw.option_c_ta?.trim() ?? '',
        optionD: raw.option_d_ta?.trim() ?? '',
      };
      if (!fields.optionA || !fields.optionB || !fields.optionC || !fields.optionD) {
        return { rowNumber, status: 'invalid', reason: `Missing Tamil option(s) in row ${rowNumber}` };
      }
      data.questionTextTa = fields.questionText;
      data.optionATa = fields.optionA;
      data.optionBTa = fields.optionB;
      data.optionCTa = fields.optionC;
      data.optionDTa = fields.optionD;
      hashes.push(computeContentHash(fields) + ':TA');
    }

    if (hasEn) {
      const fields = {
        questionText: raw.question_en.trim(),
        optionA: raw.option_a_en?.trim() ?? '',
        optionB: raw.option_b_en?.trim() ?? '',
        optionC: raw.option_c_en?.trim() ?? '',
        optionD: raw.option_d_en?.trim() ?? '',
      };
      if (!fields.optionA || !fields.optionB || !fields.optionC || !fields.optionD) {
        return { rowNumber, status: 'invalid', reason: `Missing English option(s) in row ${rowNumber}` };
      }
      data.questionTextEn = fields.questionText;
      data.optionAEn = fields.optionA;
      data.optionBEn = fields.optionB;
      data.optionCEn = fields.optionC;
      data.optionDEn = fields.optionD;
      hashes.push(computeContentHash(fields) + ':EN');
    }

    // Exact-duplicate check — within this file, and against the existing bank.
    for (const h of hashes) {
      if (seenHashesInFile.has(h)) {
        return { rowNumber, status: 'duplicate', reason: `Duplicate of an earlier row in this file` };
      }
    }
    for (const h of hashes) {
      const [hash, lang] = h.split(':');
      // Include status/id in the reason so an admin can immediately tell
      // WHERE the conflicting row actually is (Draft/Published/Disabled)
      // instead of having to hunt across tabs — this is exactly the
      // question that comes up after a bulk delete that only "soft
      // deleted" (Disabled) some rows due to quiz-session history.
      const existing = await prisma.question.findFirst({ where: { contentHash: hash, language: lang as Language }, select: { id: true, status: true } });
      if (existing) {
        return {
          rowNumber,
          status: 'duplicate',
          reason: `Matches an existing ${existing.status} question in the bank (${lang}, id: ${existing.id})`,
        };
      }
    }
    hashes.forEach((h) => seenHashesInFile.add(h));

    return { rowNumber, status: 'valid', data };
  }

  /** Phase 2 — actually inserts the admin-approved rows, applying the batch metadata to every one. */
  async confirmImport(rows: PreviewRow['data'][], batchMeta: BatchMetadata, uploadedBy: string): Promise<{ batchId: string; inserted: number }> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const idsNeedingTranslation: string[] = [];
    const allInsertedIds: string[] = []; // both TA and EN rows — tags apply regardless of which language a student gets
    let inserted = 0;

    // Resolved once per batch (not per row) — same find-or-create pattern as
    // the single Add Question form, just applied to every row up front.
    const subjectName = batchMeta.subjectName?.trim();
    const subjectId = subjectName ? (await prisma.subject.upsert({ where: { name: subjectName }, create: { name: subjectName }, update: {} })).id : undefined;

    for (const row of rows) {
      if (!row) continue;
      const hasTa = !!row.questionTextTa;
      const hasEn = !!row.questionTextEn;

      let firstId: string | null = null;
      let groupId: string | null = null;

      if (hasTa) {
        const id = await this.insertLanguageVersion(row, 'TA', batchMeta, subjectId, batchId, null);
        firstId = id;
        groupId = id;
        allInsertedIds.push(id);
      }
      if (hasEn) {
        const id = await this.insertLanguageVersion(row, 'EN', batchMeta, subjectId, batchId, groupId);
        if (!firstId) firstId = id;
        allInsertedIds.push(id);
      }
      if (firstId) {
        inserted++;
        if (!hasTa || !hasEn) idsNeedingTranslation.push(firstId); // only one language provided — queue the other
      }
    }

    // Original/Book/Other only (finalized requirement) — tags every
    // inserted question with the additional Authorities this whole batch
    // ALSO applies to, beyond its primary authorityId. One insert per
    // (question, authority) pair — createMany with skipDuplicates since
    // the @@unique constraint would otherwise reject a re-run of the same
    // batch metadata.
    if (batchMeta.additionalAuthorityIds && batchMeta.additionalAuthorityIds.length > 0 && allInsertedIds.length > 0) {
      await prisma.questionAuthorityTag.createMany({
        data: allInsertedIds.flatMap((questionId) =>
          batchMeta.additionalAuthorityIds!.map((authorityId) => ({ questionId, authorityId })),
        ),
        skipDuplicates: true,
      });
    }

    if (idsNeedingTranslation.length > 0) {
      this.translateQueuedRows(idsNeedingTranslation).catch((err) =>
        console.error(`Background translation failed for batch ${batchId}:`, err),
      );
    }

    return { batchId, inserted };
  }

  private async insertLanguageVersion(
    row: NonNullable<PreviewRow['data']>,
    lang: 'TA' | 'EN',
    batchMeta: BatchMetadata,
    subjectId: string | undefined,
    batchId: string,
    groupId: string | null,
  ): Promise<string> {
    const fields = lang === 'TA'
      ? { questionText: row.questionTextTa!, optionA: row.optionATa!, optionB: row.optionBTa!, optionC: row.optionCTa!, optionD: row.optionDTa! }
      : { questionText: row.questionTextEn!, optionA: row.optionAEn!, optionB: row.optionBEn!, optionC: row.optionCEn!, optionD: row.optionDEn! };

    const contentHash = computeContentHash(fields);
    const created = await prisma.question.create({
      data: {
        ...fields,
        correctOption: row.correctAnswer,
        language: lang as Language,
        authorityId: batchMeta.authorityId,
        categoryId: batchMeta.categoryId,
        subCategoryId: batchMeta.subCategoryId,
        examName: batchMeta.examName,
        examYear: batchMeta.examYear,
        subjectId,
        sourceType: batchMeta.sourceType,
        sourceName: batchMeta.sourceName,
        category: QuestionCategory.STANDARD,
        status: QuestionStatus.DRAFT,
        contentHash,
        sourceBatchId: batchId,
        translationGroupId: groupId ?? undefined,
      },
      select: { id: true },
    });

    if (!groupId) {
      await prisma.question.update({ where: { id: created.id }, data: { translationGroupId: created.id } });
    }
    return created.id;
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
}
