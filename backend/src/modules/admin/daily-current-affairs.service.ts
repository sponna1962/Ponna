// Daily Quiz AI generation lives here for the two automated daily content types.
// Generated quizzes are written directly to DailyQuiz/DailyQuizQuestion; they
// never create normal Question rows and never enter the Question/DRAFT bank.

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

function brainPrompt(): string {
  return `Create ${QUESTIONS_PER_DAY} original TNPSC-style Brain Challenge multiple-choice questions for a daily practice quiz. These must test reasoning and problem-solving, NOT current affairs or news. Mix logical reasoning, number patterns, arithmetic reasoning, analytical thinking, ordering/arrangement, age/time/work/clock reasoning, data interpretation, and observation-based reasoning. Avoid trivia, memorisation-only questions, politics/news facts, and ambiguous wordplay.

Every question must be solvable from the information stated in the question itself. Use exactly four distinct options and exactly one correct answer. Independently solve every problem before returning it. Make distractors plausible near-misses, not random answers. Vary the underlying concepts; do not repeat the same puzzle with different names or numbers. Return both Tamil and English versions with the same meaning, plus a concise explanation in both languages.

Return ONLY valid JSON in this exact shape:
{"questions":[{"questionTextTa":"...","optionATa":"...","optionBTa":"...","optionCTa":"...","optionDTa":"...","questionTextEn":"...","optionAEn":"...","optionBEn":"...","optionCEn":"...","optionDEn":"...","correctOption":"A","explanationTa":"...","explanationEn":"..."}]}

Quality rules: exactly ${QUESTIONS_PER_DAY} questions; four options A-D; exactly one correct option; no duplicate or near-duplicate question concepts; no current-affairs facts; no missing conditions; no unsupported assumptions; arithmetic must be checked independently; explanations must agree with the displayed answer.`;
}

export class DailyCurrentAffairsService {
  private buildPrompt(dateLabel: string): string {
    return `Using Google Search, find the ${QUESTIONS_PER_DAY} most significant real news events from Tamil Nadu and India from ${dateLabel} that would be useful Current Affairs learning for a TNPSC Group - IV aspirant. Focus on government, polity, economy, science and technology, environment, important appointments, awards, reports, schemes, court/judicial developments, national/international developments relevant to India, and other exam-relevant factual news. Avoid entertainment and sports trivia.\n\nFor each event, create one TNPSC-style multiple-choice question in Tamil and English with exactly four options, one correct answer, and a short explanation in both languages.\n\nRespond ONLY as JSON:\n{\"questions\":[{\"questionTextTa\":\"...\",\"optionATa\":\"...\",\"optionBTa\":\"...\",\"optionCTa\":\"...\",\"optionDTa\":\"...\",\"questionTextEn\":\"...\",\"optionAEn\":\"...\",\"optionBEn\":\"...\",\"optionCEn\":\"...\",\"optionDEn\":\"...\",\"correctOption\":\"A\",\"explanationTa\":\"...\",\"explanationEn\":\"...\"}]}\n\nOnly use facts supported by the real search results. Do not invent events. Return fewer only if there are genuinely fewer than ${QUESTIONS_PER_DAY} suitable events.`;
  }

  private async generateQuestions(prompt: string): Promise<GeneratedQuestion[]> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 9000 },
      }),
    });
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try {
      const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')) as { questions?: GeneratedQuestion[] };
      return (parsed.questions ?? []).slice(0, QUESTIONS_PER_DAY);
    } catch {
      throw new Error('AI returned invalid JSON for the Daily Quiz');
    }
  }

  private async createDailyQuiz(quizDate: string, quizType: DailyQuizType, questions: GeneratedQuestion[]) {
    const publishAt = istToUtc(quizDate, '07:00');
    const expiresAt = new Date(publishAt.getTime() + 24 * 60 * 60 * 1000);
    return prisma.dailyQuiz.create({
      data: {
        quizDate: new Date(quizDate), quizType, publishAt, expiresAt,
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
  }

  /** Generate today's Current Affairs Daily Quiz directly. */
  async generateDailyQuiz(): Promise<{ created: number; quizId: string | null; quizDate: string; skippedNoResults: boolean }> {
    const quizDate = todayIstDateStr();
    const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate_quizType: { quizDate: new Date(quizDate), quizType: DailyQuizType.DAILY_QUIZ } } });
    if (existing) return { created: 0, quizId: existing.id, quizDate, skippedNoResults: false };
    const questions = await this.generateQuestions(this.buildPrompt(yesterdayLabel()));
    if (questions.length === 0) return { created: 0, quizId: null, quizDate, skippedNoResults: true };
    const quiz = await this.createDailyQuiz(quizDate, DailyQuizType.DAILY_QUIZ, questions);
    return { created: quiz.questions.length, quizId: quiz.id, quizDate, skippedNoResults: false };
  }

  /** Generate today's Brain Challenge Daily Quiz directly. */
  async generateBrainChallenge(): Promise<{ created: number; quizId: string | null; quizDate: string; skippedNoResults: boolean }> {
    const quizDate = todayIstDateStr();
    const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate_quizType: { quizDate: new Date(quizDate), quizType: DailyQuizType.BRAIN_CHALLENGE } } });
    if (existing) return { created: 0, quizId: existing.id, quizDate, skippedNoResults: false };
    const questions = await this.generateQuestions(brainPrompt());
    if (questions.length < QUESTIONS_PER_DAY) throw new Error(`AI generated only ${questions.length} Brain Challenge questions; 10 are required, so nothing was published.`);
    const quiz = await this.createDailyQuiz(quizDate, DailyQuizType.BRAIN_CHALLENGE, questions);
    return { created: quiz.questions.length, quizId: quiz.id, quizDate, skippedNoResults: false };
  }

  // Backward-compatible entry point for the existing Current Affairs route/cron.
  async generateDailyBatch(_subCategoryId?: string) {
    return this.generateDailyQuiz();
  }
}

export const dailyCurrentAffairsService = new DailyCurrentAffairsService();
