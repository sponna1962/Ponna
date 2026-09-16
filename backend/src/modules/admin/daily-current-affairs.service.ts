// Daily Current Affairs question generation (Sept 2026, Group IV
// first). Explicit request: daily (not weekly), every morning, drafted
// from the PREVIOUS day's real news, newest always sorted to the top.
//
// Uses Gemini's OWN built-in Google Search grounding tool (the
// `google_search` tool in the Gemini API request) rather than the
// separate live-search-adapter.ts used by Ask Ponna -- that adapter
// needs GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_ENGINE_ID, which are NOT
// YET SET on Render (see live-search-adapter.ts's own header comment).
// Gemini's built-in search grounding needs only the ALREADY-WORKING
// GEMINI_API_KEY this whole app already depends on for every other AI
// feature -- no new credential setup required to get this running.
//
// "Verified, Not Guessed" philosophy, same as everywhere else: every
// generated question is created with status=DRAFT (the Question
// model's own default) -- an admin must review and publish each one
// via the normal Questions admin page before a student ever sees it.
// This service only ever drafts; nothing it does publishes a question.

import { QuestionCategory, SourceType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const EST_INPUT_COST_PER_1M = 0.75;
const EST_OUTPUT_COST_PER_1M = 3.75;

// One TA/EN pair per topic covered -- kept small since this runs daily
// (accumulates fast) and each one still needs a human review before
// publishing.
const QUESTIONS_PER_DAY = 5;

interface DraftQuestion {
  headline: string;
  questionTextTa: string;
  optionATa: string;
  optionBTa: string;
  optionCTa: string;
  optionDTa: string;
  questionTextEn: string;
  optionAEn: string;
  optionBEn: string;
  optionCEn: string;
  optionDEn: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanationTa: string;
  explanationEn: string;
}

export class DailyCurrentAffairsService {
  private buildPrompt(yesterdayLabel: string): string {
    return `Using Google Search, find the ${QUESTIONS_PER_DAY} most significant, real news events from Tamil Nadu and India from ${yesterdayLabel} that would be relevant Current Affairs content for a TNPSC Group - IV exam aspirant (SSLC-standard government/civic affairs, not entertainment/sports trivia).

For EACH event, write one multiple-choice question in TNPSC's own style (SSLC-standard difficulty, factual, exam-appropriate), in BOTH Tamil and English, with exactly 4 options and one correct answer, plus a short explanation of why the answer is correct.

Respond with ONLY a JSON object, no markdown fences:
{"questions": [{"headline": "<short 5-8 word summary of the news event>", "questionTextTa": "...", "optionATa": "...", "optionBTa": "...", "optionCTa": "...", "optionDTa": "...", "questionTextEn": "...", "optionAEn": "...", "optionBEn": "...", "optionCEn": "...", "optionDEn": "...", "correctOption": "A", "explanationTa": "...", "explanationEn": "..."}]}
Only include events you found real, current search results for -- never invent a news event. If fewer than ${QUESTIONS_PER_DAY} genuinely significant events exist for that day, return fewer rather than padding with invented ones.`;
  }

  /** Generates today's draft batch for one exam, covering YESTERDAY's
   * news (the explicit requirement -- run every morning, covering the
   * previous day). Each question is created TWICE (a TA row + an EN
   * row, linked via translationGroupId) as DRAFT, category
   * CURRENT_AFFAIRS, relevanceDate = yesterday -- an admin reviews and
   * publishes each via the normal Questions admin page. */
  async generateDailyBatch(subCategoryId: string): Promise<{ created: number; skippedNoResults: boolean }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayLabel = yesterday.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: this.buildPrompt(yesterdayLabel) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let parsed: { questions: DraftQuestion[] } = { questions: [] };
    try {
      parsed = JSON.parse(rawText.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      console.error('[daily-current-affairs] JSON parse failed:', rawText.slice(0, 500));
    }
    if (parsed.questions.length === 0) {
      return { created: 0, skippedNoResults: true };
    }

    let created = 0;
    for (const q of parsed.questions) {
      const translationGroupId = randomUUID();
      await prisma.question.create({
        data: {
          questionText: q.questionTextTa,
          optionA: q.optionATa,
          optionB: q.optionBTa,
          optionC: q.optionCTa,
          optionD: q.optionDTa,
          correctOption: q.correctOption,
          explanationTa: q.explanationTa,
          explanationEn: q.explanationEn,
          language: 'TA',
          translationGroupId,
          subCategoryId,
          category: QuestionCategory.CURRENT_AFFAIRS,
          relevanceDate: yesterday,
          sourceType: SourceType.ORIGINAL,
        },
      });
      await prisma.question.create({
        data: {
          questionText: q.questionTextEn,
          optionA: q.optionAEn,
          optionB: q.optionBEn,
          optionC: q.optionCEn,
          optionD: q.optionDEn,
          correctOption: q.correctOption,
          explanationTa: q.explanationTa,
          explanationEn: q.explanationEn,
          language: 'EN',
          translationGroupId,
          subCategoryId,
          category: QuestionCategory.CURRENT_AFFAIRS,
          relevanceDate: yesterday,
          sourceType: SourceType.ORIGINAL,
        },
      });
      created += 2;
    }

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    console.log(
      `[daily-current-affairs] Generated ${parsed.questions.length} events (${created} question rows) for ${yesterdayLabel}. est_cost=$${((inputTokens / 1_000_000) * EST_INPUT_COST_PER_1M + (outputTokens / 1_000_000) * EST_OUTPUT_COST_PER_1M).toFixed(4)}`,
    );
    return { created, skippedNoResults: false };
  }
}

export const dailyCurrentAffairsService = new DailyCurrentAffairsService();
