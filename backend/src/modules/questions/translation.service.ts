// Translation Service — implements bi-directional Tamil↔English translation
// for questions (a follow-up requirement after §6.2's translationGroupId
// field was added). Used by both:
//   - the single-question admin form (type in one language, the other
//     auto-fills, admin reviews both before publishing)
//   - bulk CSV upload (when only one language column is filled, the other
//     is generated automatically as part of the same background pass that
//     already runs AI difficulty classification)
//
// Deliberately does NOT auto-publish translated content on its own — a
// translated question is created as a linked Draft row (sharing the
// original's translationGroupId) so an admin still reviews before it goes
// live, since a subtly wrong translation of the correct-answer option would
// otherwise silently corrupt what a student is tested on.

import { PrismaClient, Language, CorrectOption, QuestionStatus, QuestionCategory } from '@prisma/client';
import { computeContentHash } from '../../common/content-hash';

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-1.5-flash';

interface TranslatedFields {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export class TranslationService {
  /** Raw translate call — takes one language's fields, returns the other's. Does not touch the database. */
  async translateFields(fields: TranslatedFields, fromLang: Language, toLang: Language): Promise<TranslatedFields> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set — translation is unavailable until this is configured.');
    }

    const targetName = toLang === 'TA' ? 'Tamil' : 'English';
    const prompt = `Translate this competitive-exam practice question from ${fromLang === 'TA' ? 'Tamil' : 'English'} to ${targetName}. Preserve the exact meaning, especially for the correct answer option — accuracy matters more than fluency here, since this is used to test students.

Question: ${fields.questionText}
A. ${fields.optionA}
B. ${fields.optionB}
C. ${fields.optionC}
D. ${fields.optionD}

Respond with ONLY a JSON object, no other text, no markdown fences:
{"questionText": "...", "optionA": "...", "optionB": "...", "optionC": "...", "optionD": "..."}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini translation error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(cleaned) as TranslatedFields;
    } catch {
      throw new Error(`Could not parse translation response: ${text}`);
    }
  }

  /**
   * Full flow for the single-question admin form: given fields typed in one
   * language, returns the translated fields for the other — used to live-fill
   * the second half of the form. Does NOT save anything; the admin's eventual
   * "Publish" / "Save as Draft" click is what persists both languages (see
   * question.service.ts's createBilingualPair).
   */
  async previewTranslation(fields: TranslatedFields, fromLang: Language): Promise<TranslatedFields> {
    const toLang = fromLang === 'TA' ? Language.EN : Language.TA;
    return this.translateFields(fields, fromLang, toLang);
  }

  /**
   * Bulk-upload flow: given an already-saved question in one language,
   * generates and saves its translation as a new linked Draft row. Used when
   * a CSV row only supplied one language's columns. Idempotent per
   * translationGroupId — won't create a second translation if one already
   * exists for this question.
   */
  async createMissingTranslation(questionId: string): Promise<string | null> {
    const original = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });

    // Ensure this question has a translation group of its own if it doesn't yet.
    const groupId = original.translationGroupId ?? original.id;
    if (!original.translationGroupId) {
      await prisma.question.update({ where: { id: original.id }, data: { translationGroupId: groupId } });
    }

    const existingTranslation = await prisma.question.findFirst({
      where: { translationGroupId: groupId, language: { not: original.language }, id: { not: original.id } },
    });
    if (existingTranslation) return existingTranslation.id; // already has one — don't duplicate

    const toLang = original.language === 'TA' ? Language.EN : Language.TA;
    const translated = await this.translateFields(
      {
        questionText: original.questionText,
        optionA: original.optionA,
        optionB: original.optionB,
        optionC: original.optionC,
        optionD: original.optionD,
      },
      original.language,
      toLang,
    );

    const contentHash = computeContentHash(translated);
    const created = await prisma.question.create({
      data: {
        ...translated,
        correctOption: original.correctOption, // the option LETTER doesn't change in translation
        language: toLang,
        translationGroupId: groupId,
        authorityId: original.authorityId,
        categoryId: original.categoryId,
        subCategoryId: original.subCategoryId,
        examName: original.examName,
        difficulty: original.difficulty,
        category: original.category,
        relevanceDate: original.relevanceDate,
        examYear: original.examYear,
        sourceType: original.sourceType,
        sourceName: original.sourceName,
        internalNotes: original.internalNotes,
        status: QuestionStatus.DRAFT, // always Draft — a human reviews a translation before it goes live
        contentHash,
        sourceBatchId: original.sourceBatchId,
      },
    });

    return created.id;
  }
}
