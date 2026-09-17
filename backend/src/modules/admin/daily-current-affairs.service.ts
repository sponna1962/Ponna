// Daily Current Affairs generation now belongs to the Daily Quiz workflow.
// It creates a DailyQuiz directly; it never creates Question rows and never
// sends generated questions to the normal Question/DRAFT bank.

import { CorrectOption, DailyQuizStatus, DailyQuizType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const QUESTIONS_PER_DAY = 10;
const IST_OFFSET_MINUTES = 5 * 60 + 30;

interface GeneratedQuestion {
  questionTextTa: string; optionATa: string; optionBTa: string; optionCTa: string; optionDTa: string;
  questionTextEn: string; optionAEn: string; optionBEn: string; optionCEn: string; optionDEn: string;
  correctOption: 'A' | 'B' | 'C' | 'D'; explanationTa: string; explanationEn: string;
}

function istToUtc(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - IST_OFFSET_MINUTES * 60 * 1000);
}

function todayIstDateStr(): string {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

function yesterdayLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export class DailyCurrentAffairsService {
  private buildPrompt(dateLabel: string): string {
    return `Using Google Search, find the ${QUESTIONS_PER_DAY} most significant real news events from Tamil Nadu and India from ${dateLabel} that would be useful Current Affairs learning for a TNPSC Group - IV aspirant. Focus on government, polity, economy, science and technology, environment, important appointments, awards, reports, schemes, court/judicial developments, national/international developments relevant to India, and other exam-relevant factual news. Avoid entertainment and sports trivia.

For each event, create one TNPSC-style multiple-choice question in Tamil and English with exactly four options, one correct answer, and a short explanation in both languages.

Respond ONLY as JSON:
{"questions":[{"questionTextTa":"...","optionATa":"...","optionBTa":"...","optionCTa":"...","optionDTa":"...","questionTextEn":"...","optionAEn":"...","optionBEn":"...","optionCEn":"...","optionDEn":"...","correctOption":"A","explanationTa":"...","explanationEn":"..."}]}

Only use facts supported by the real search results. Do not invent events. Return fewer only if there are genuinely fewer than ${QUESTIONS_PER_DAY} suitable events.`;
  }

  /** Generate today's Current Affairs Daily Quiz directly. */
  async generateDailyQuiz(): Promise<{ created: number; quizId: string | null; quizDate: string; skippedNoResults: boolean }> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

    const quizDate = todayIstDateStr();
    const existing = await prisma.dailyQuiz.findUnique({
      where: { quizDate_quizType: { quizDate: new Date(quizDate), quizType: DailyQuizType.DAILY_QUIZ } },
    });
    if (existing) return { created: 0, quizId: existing.id, quizDate, skippedNoResults: false };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: this.buildPrompt(yesterdayLabel()) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 7000 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);

    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    let questions: GeneratedQuestion[] = [];
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as { questions?: GeneratedQuestion[] };
      questions = (parsed.questions ?? []).slice(0, QUESTIONS_PER_DAY);
    } catch {
      throw new Error('AI returned invalid JSON for the Daily Current Affairs quiz');
    }
    if (questions.length === 0) return { created: 0, quizId: null, quizDate, skippedNoResults: true };

    const publishAt = istToUtc(quizDate, '07:00');
    const expiresAt = new Date(publishAt.getTime() + 24 * 60 * 60 * 1000);
    const quiz = await prisma.dailyQuiz.create({
      data: {
        quizDate: new Date(quizDate), quizType: DailyQuizType.DAILY_QUIZ, publishAt, expiresAt,
        // Quiz-level state only. There is no normal Question-bank DRAFT.
        status: DailyQuizStatus.SCHEDULED,
        questions: { create: questions.map((q, index) => ({
          sequenceNumber: index + 1,
          questionTextTa: q.questionTextTa, optionATa: q.optionATa, optionBTa: q.optionBTa, optionCTa: q.optionCTa, optionDTa: q.optionDTa,
          questionTextEn: q.questionTextEn, optionAEn: q.optionAEn, optionBEn: q.optionBEn, optionCEn: q.optionCEn, optionDEn: q.optionDEn,
          correctOption: q.correctOption as CorrectOption, explanationTa: q.explanationTa, explanationEn: q.explanationEn,
        })) },
      },
      include: { questions: true },
    });
    return { created: quiz.questions.length, quizId: quiz.id, quizDate, skippedNoResults: false };
  }
}

export const dailyCurrentAffairsService = new DailyCurrentAffairsService();
