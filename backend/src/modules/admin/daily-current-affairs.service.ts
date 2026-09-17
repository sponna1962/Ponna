// Daily Quiz AI generation lives here for the two automated daily content types.
// Current Affairs has a strict two-step verification gate before questions are
// generated. Generated quizzes are written directly to DailyQuiz/
// DailyQuizQuestion; they never create normal Question rows or enter DRAFT.

import { CorrectOption, DailyQuizStatus, DailyQuizType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const QUESTIONS_PER_DAY = 10;
const CURRENT_AFFAIRS_WINDOW_HOURS = 48;
const IST_OFFSET_MINUTES = 5 * 60 + 30;

interface GeneratedQuestion {
  questionTextTa: string; optionATa: string; optionBTa: string; optionCTa: string; optionDTa: string;
  questionTextEn: string; optionAEn: string; optionBEn: string; optionCEn: string; optionDEn: string;
  correctOption: 'A' | 'B' | 'C' | 'D'; explanationTa: string; explanationEn: string;
}

interface NewsCandidate {
  headline: string;
  eventDateTime: string;
  location: string;
  facts: string[];
}

interface VerifiedNewsEvent extends NewsCandidate {
  sourcePublishedAt: string;
  sourceUrl: string;
  verificationNote: string;
}

function istToUtc(dateStr: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - IST_OFFSET_MINUTES * 60 * 1000);
}

function todayIstDateStr(): string {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

function currentIstIso(): string {
  return new Date(Date.now() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().replace('Z', '+05:30');
}

function isoWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - CURRENT_AFFAIRS_WINDOW_HOURS * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function cleanJson(raw: string): string {
  return raw.replace(/^```json\s*|\s*```$/g, '').trim();
}

// Exact-text duplicate guard. This is deliberately deterministic and runs
// AFTER AI generation as a hard gate. Whitespace/case/punctuation-only
// changes are treated as duplicates.
function normalizeQuestion(text: string): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[.,!?;:'\"“”‘’()\[\]{}<>/\\|\-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function brainPrompt(previousQuestions: string[]): string {
  const previousText = previousQuestions.length
    ? previousQuestions.slice(0, 1000).join('\n')
    : '(none)';

  return `Create exactly ${QUESTIONS_PER_DAY} original TNPSC-style Brain Challenge multiple-choice questions for today's daily challenge.

PURPOSE: This is a reasoning challenge, NOT a current-affairs quiz and NOT a normal memory/trivia quiz. The student should have to think, calculate, compare, infer, arrange, or detect a pattern.

DIFFICULTY: Use ONLY Medium and Hard questions. Target 5 Medium + 5 Hard. Do not generate Easy questions.

MIX THE QUESTION TYPES across the 10 questions. Use a balanced mixture of:
- logical reasoning
- number/pattern reasoning
- arithmetic reasoning
- ordering and arrangement
- age/time/work/clock reasoning
- data interpretation
- analytical deduction
- observation/comparison
- statement/conclusion or condition-based reasoning
- short puzzle/problem-solving
Do not use the same category repeatedly when another valid category can be used.

QUALITY RULES:
1. Every question must be solvable from the information stated in that question.
2. Exactly four distinct options A-D and exactly one correct answer.
3. Distractors must be plausible and based on realistic mistakes, not random numbers.
4. Arithmetic must be independently checked before returning the question.
5. Avoid ambiguous wording, trick wording, hidden assumptions, culturally dependent clues, and questions with two defensible answers.
6. Do not use current affairs, politics, recent news, or facts that require outside knowledge.
7. Do not repeat the same puzzle by changing names, numbers, dates, or wording.
8. Each question must test a meaningfully different reasoning skill or underlying structure.
9. Tamil and English versions must have exactly the same logical meaning and answer.
10. Give a concise explanation showing why the correct answer is correct.

NO-REPEAT RULE — CRITICAL:
A question created on a previous day must NOT be generated again today. Do not repeat the same wording, translated equivalent, near-identical puzzle, same underlying logic with different numbers/names, or the same question concept with superficial changes. Choose genuinely different puzzles.

PREVIOUS BRAIN CHALLENGE QUESTIONS:
${previousText}

Return ONLY valid JSON in this exact shape:
{"questions":[{"questionTextTa":"...","optionATa":"...","optionBTa":"...","optionCTa":"...","optionDTa":"...","questionTextEn":"...","optionAEn":"...","optionBEn":"...","optionCEn":"...","optionDEn":"...","correctOption":"A","explanationTa":"...","explanationEn":"..."}]}

Final checks before returning: exactly 10 questions; approximately 5 Medium and 5 Hard; four options each; one correct answer each; no duplicate or near-duplicate concepts; no previous question reused; no current-affairs facts; all calculations verified.`;
}

export class DailyCurrentAffairsService {
  private async gemini(prompt: string, useGoogleSearch: boolean, maxOutputTokens = 9000): Promise<any> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens },
    };
    if (useGoogleSearch) body.tools = [{ google_search: {} }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    try { return JSON.parse(cleanJson(raw)); }
    catch { throw new Error('AI returned invalid JSON for the Daily Quiz'); }
  }

  /** STEP 1 — discover only events inside the rolling 48-hour eligibility window. */
  private async discoverCurrentEvents(windowStart: string, windowEnd: string): Promise<NewsCandidate[]> {
    const prompt = `CURRENT AFFAIRS STEP 1 — NEWS DISCOVERY.\n\nFind 15-20 significant, exam-relevant events from Tamil Nadu, India, and important international developments relevant to India. ELIGIBILITY IS STRICT: the event itself must have happened or first occurred between ${windowStart} and ${windowEnd} (UTC). This is a rolling ${CURRENT_AFFAIRS_WINDOW_HOURS}-hour window, not a weekly/monthly search.\n\nDo NOT include: older events that are merely reported again today; old government schemes; old appointments; old court judgments; old statistics/reports; anniversary/remembrance stories; background stories; follow-up stories where the underlying event happened before the window; evergreen facts. If the event date/time cannot be established, exclude it.\n\nReturn ONLY JSON:\n{\"events\":[{\"headline\":\"...\",\"eventDateTime\":\"ISO-8601 UTC time when the event happened/first occurred\",\"location\":\"...\",\"facts\":[\"fact 1\",\"fact 2\"]}]}\n\nUse Google Search. Prefer authoritative/primary sources and reputable news reports. Do not invent dates or facts. The eventDateTime is the date of the event, NOT simply the date a webpage was updated.`;
    const parsed = await this.gemini(prompt, true, 8000) as { events?: NewsCandidate[] };
    return (parsed.events ?? []).slice(0, 20);
  }

  /** STEP 2 — independently search and verify date + facts before generation. */
  private async verifyCurrentEvents(candidates: NewsCandidate[], windowStart: string, windowEnd: string): Promise<{ verified: VerifiedNewsEvent[]; rejectedOld: number; rejectedUnverified: number }> {
    const candidateText = candidates.map((c, i) => `${i + 1}. ${c.headline}\nClaimed event time: ${c.eventDateTime}\nLocation: ${c.location}\nFacts: ${c.facts.join(' | ')}`).join('\n\n');
    const prompt = `CURRENT AFFAIRS STEP 2 — INDEPENDENT VERIFICATION.\n\nYou are a separate verification pass. Search Google independently for each candidate below. Do NOT trust its claimed date or facts. Confirm the event using reliable sources.\n\nSTRICT ELIGIBILITY WINDOW: ${windowStart} through ${windowEnd} UTC (${CURRENT_AFFAIRS_WINDOW_HOURS} hours).\n\nAccept an event ONLY when: (1) the event itself happened/first occurred inside this window, (2) at least one reliable source confirms the event and its date, (3) the key factual claim is supported, and (4) it is suitable for a TNPSC current-affairs question. A webpage published inside the window does NOT make an old event eligible. If sources disagree on the event date, reject it. If the exact event date cannot be verified, reject it. Reject recycled coverage of an old event.\n\nCANDIDATES:\n${candidateText}\n\nReturn ONLY JSON:\n{\"verifiedEvents\":[{\"headline\":\"...\",\"eventDateTime\":\"verified ISO-8601 UTC event time\",\"location\":\"...\",\"facts\":[\"verified fact 1\",\"verified fact 2\"],\"sourcePublishedAt\":\"ISO-8601 UTC publication time\",\"sourceUrl\":\"https://...\",\"verificationNote\":\"why the date and fact are verified\"}],\"rejectedOld\":0,\"rejectedUnverified\":0}\n\nNever fill missing evidence by guessing. Never convert an old event into a new event merely because there is a fresh article.`;
    const parsed = await this.gemini(prompt, true, 9000) as { verifiedEvents?: VerifiedNewsEvent[]; rejectedOld?: number; rejectedUnverified?: number };
    const startMs = new Date(windowStart).getTime();
    const endMs = new Date(windowEnd).getTime();
    const verified = (parsed.verifiedEvents ?? []).filter((e) => {
      const eventMs = new Date(e.eventDateTime).getTime();
      const sourceMs = new Date(e.sourcePublishedAt).getTime();
      return Number.isFinite(eventMs) && eventMs >= startMs && eventMs <= endMs && Number.isFinite(sourceMs) && sourceMs <= endMs && !!e.sourceUrl && Array.isArray(e.facts) && e.facts.length > 0;
    });
    return { verified, rejectedOld: Number(parsed.rejectedOld ?? 0), rejectedUnverified: Number(parsed.rejectedUnverified ?? 0) };
  }

  private async generateCurrentAffairsQuestions(events: VerifiedNewsEvent[], previousQuestions: string[]): Promise<GeneratedQuestion[]> {
    const eventText = events.map((e, i) => `${i + 1}. ${e.headline}\nEvent time: ${e.eventDateTime}\nVerified facts: ${e.facts.join(' | ')}\nSource: ${e.sourceUrl}`).join('\n\n');
    const oldText = previousQuestions.length ? previousQuestions.slice(0, 300).join('\n') : '(none)';
    const prompt = `CURRENT AFFAIRS QUESTION GENERATION — ONLY VERIFIED EVENTS.\n\nCreate exactly ${QUESTIONS_PER_DAY} TNPSC Group-IV-style MCQs using ONLY the verified events below. Every question must be directly based on a verified event. Do not use general knowledge or any fact not present in the verified event data.\n\nVERIFIED EVENTS:\n${eventText}\n\nPREVIOUS CURRENT-AFFAIRS QUESTIONS — DO NOT REPEAT ANY QUESTION FROM ANY PREVIOUS DAY. This includes the same wording, a punctuation/whitespace/case variation, a translated equivalent, or a near-identical question. Do not reuse the same event, fact, event angle, or question concept merely by changing names, numbers, wording, or language. If a previous question is about an event/fact, choose a different newly occurring event/fact for today.\n\n${oldText}\n\nFor every question, preserve the verified fact exactly enough to remain factually correct. Do not ask about an older background fact just because it appears in the event story. If an event has multiple facts, use only the newly verified fact.\n\nReturn ONLY valid JSON:\n{\"questions\":[{\"questionTextTa\":\"...\",\"optionATa\":\"...\",\"optionBTa\":\"...\",\"optionCTa\":\"...\",\"optionDTa\":\"...\",\"questionTextEn\":\"...\",\"optionAEn\":\"...\",\"optionBEn\":\"...\",\"optionCEn\":\"...\",\"optionDEn\":\"...\",\"correctOption\":\"A\",\"explanationTa\":\"...\",\"explanationEn\":\"...\"}]}\n\nRules: exactly ${QUESTIONS_PER_DAY}; four options; one correct option; Tamil and English must have identical meaning; no duplicate question concepts; no old/currently recycled events; explanations must agree with the answer.`;
    const parsed = await this.gemini(prompt, false, 10000) as { questions?: GeneratedQuestion[] };
    return (parsed.questions ?? []).slice(0, QUESTIONS_PER_DAY);
  }

  private async previousCurrentAffairsQuestions(): Promise<string[]> {
    const rows = await prisma.dailyQuizQuestion.findMany({
      where: { dailyQuiz: { quizType: DailyQuizType.DAILY_QUIZ } },
      select: { questionTextTa: true, questionTextEn: true },
      orderBy: { dailyQuiz: { quizDate: 'desc' } },
      take: 300,
    });
    return rows.flatMap((r) => [r.questionTextTa, r.questionTextEn]).filter(Boolean);
  }

  private removeExactPreviousDuplicates(questions: GeneratedQuestion[], previousQuestions: string[]): GeneratedQuestion[] {
    const used = new Set(previousQuestions.map(normalizeQuestion).filter(Boolean));
    const accepted: GeneratedQuestion[] = [];
    for (const q of questions) {
      const taKey = normalizeQuestion(q.questionTextTa);
      const enKey = normalizeQuestion(q.questionTextEn);
      if (!taKey || !enKey || used.has(taKey) || used.has(enKey)) continue;
      if (accepted.some((a) => normalizeQuestion(a.questionTextTa) === taKey || normalizeQuestion(a.questionTextEn) === enKey)) continue;
      used.add(taKey);
      used.add(enKey);
      accepted.push(q);
    }
    return accepted;
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

  async generateDailyQuiz(): Promise<{ created: number; quizId: string | null; quizDate: string; skippedNoResults: boolean; verification?: any }> {
    const quizDate = todayIstDateStr();
    const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate_quizType: { quizDate: new Date(quizDate), quizType: DailyQuizType.DAILY_QUIZ } } });
    if (existing) return { created: 0, quizId: existing.id, quizDate, skippedNoResults: false };

    const { start, end } = isoWindow();
    const candidates = await this.discoverCurrentEvents(start, end);
    const verification = await this.verifyCurrentEvents(candidates, start, end);
    const eligible = verification.verified.slice(0, QUESTIONS_PER_DAY);

    if (eligible.length < QUESTIONS_PER_DAY) {
      return { created: 0, quizId: null, quizDate, skippedNoResults: true, verification: { step1Discovered: candidates.length, step2Verified: verification.verified.length, rejectedOld: verification.rejectedOld, rejectedUnverified: verification.rejectedUnverified, reason: `Only ${eligible.length} eligible events in the last ${CURRENT_AFFAIRS_WINDOW_HOURS} hours; 10 required. Nothing created.` } };
    }

    const previousQuestions = await this.previousCurrentAffairsQuestions();
    const generatedQuestions = await this.generateCurrentAffairsQuestions(eligible, previousQuestions);
    const questions = this.removeExactPreviousDuplicates(generatedQuestions, previousQuestions);

    if (questions.length < QUESTIONS_PER_DAY) {
      return { created: 0, quizId: null, quizDate, skippedNoResults: true, verification: { step1Discovered: candidates.length, step2Verified: verification.verified.length, eligibleUsed: eligible.length, generated: generatedQuestions.length, acceptedAfterNoRepeat: questions.length, rejectedOld: verification.rejectedOld, rejectedUnverified: verification.rejectedUnverified, reason: `Only ${questions.length} genuinely new questions remained after the no-repeat check; 10 required. Nothing created.` } };
    }

    const quiz = await this.createDailyQuiz(quizDate, DailyQuizType.DAILY_QUIZ, questions);
    return { created: quiz.questions.length, quizId: quiz.id, quizDate, skippedNoResults: false, verification: { step1Discovered: candidates.length, step2Verified: verification.verified.length, eligibleUsed: eligible.length, generated: generatedQuestions.length, acceptedAfterNoRepeat: questions.length, rejectedOld: verification.rejectedOld, rejectedUnverified: verification.rejectedUnverified, windowHours: CURRENT_AFFAIRS_WINDOW_HOURS } };
  }

  async generateBrainChallenge(): Promise<{ created: number; quizId: string | null; quizDate: string; skippedNoResults: boolean }> {
    const quizDate = todayIstDateStr();
    const existing = await prisma.dailyQuiz.findUnique({ where: { quizDate_quizType: { quizDate: new Date(quizDate), quizType: DailyQuizType.BRAIN_CHALLENGE } } });
    if (existing) return { created: 0, quizId: existing.id, quizDate, skippedNoResults: false };

    // Brain Challenge has its own permanent-in-practice history source:
    // previous Brain Challenge quiz questions. The prompt handles semantic
    // similarity while this deterministic gate catches exact repeats.
    const previousQuestions = await this.previousBrainChallengeQuestions();
    const generatedQuestions = await this.generateQuestionsForBrainChallenge(previousQuestions);
    const questions = this.removeExactPreviousDuplicates(generatedQuestions, previousQuestions);

    // Never pad with an old question. If the no-repeat gate leaves fewer than
    // 10 genuinely new questions, today's Brain Challenge is not created.
    if (questions.length < QUESTIONS_PER_DAY) {
      throw new Error(`Only ${questions.length} genuinely new Brain Challenge questions remained after the no-repeat check; 10 are required, so nothing was created.`);
    }

    const quiz = await this.createDailyQuiz(quizDate, DailyQuizType.BRAIN_CHALLENGE, questions);
    return { created: quiz.questions.length, quizId: quiz.id, quizDate, skippedNoResults: false };
  }

  private async previousBrainChallengeQuestions(): Promise<string[]> {
    const rows = await prisma.dailyQuizQuestion.findMany({
      where: { dailyQuiz: { quizType: DailyQuizType.BRAIN_CHALLENGE } },
      select: { questionTextTa: true, questionTextEn: true },
      orderBy: { dailyQuiz: { quizDate: 'desc' } },
      take: 1000,
    });
    return rows.flatMap((r) => [r.questionTextTa, r.questionTextEn]).filter(Boolean);
  }

  private validateBrainQuestionShape(questions: GeneratedQuestion[]): GeneratedQuestion[] {
    return questions.filter((q) => {
      const taOptions = [q.optionATa, q.optionBTa, q.optionCTa, q.optionDTa].map(normalizeQuestion);
      const enOptions = [q.optionAEn, q.optionBEn, q.optionCEn, q.optionDEn].map(normalizeQuestion);
      const taDistinct = new Set(taOptions).size === 4 && taOptions.every(Boolean);
      const enDistinct = new Set(enOptions).size === 4 && enOptions.every(Boolean);
      return !!q.questionTextTa && !!q.questionTextEn && taDistinct && enDistinct &&
        ['A', 'B', 'C', 'D'].includes(q.correctOption) && !!q.explanationTa && !!q.explanationEn;
    });
  }

  private async reviewBrainChallengeQuestions(questions: GeneratedQuestion[]): Promise<GeneratedQuestion[]> {
    const compact = questions.map((q, i) => ({
      n: i + 1, ta: q.questionTextTa,
      optionsTa: [q.optionATa, q.optionBTa, q.optionCTa, q.optionDTa],
      en: q.questionTextEn,
      optionsEn: [q.optionAEn, q.optionBEn, q.optionCEn, q.optionDEn],
      correct: q.correctOption,
      explanationTa: q.explanationTa,
      explanationEn: q.explanationEn,
    }));
    const prompt = `BRAIN CHALLENGE QUALITY REVIEW. Review these proposed TNPSC-style reasoning questions independently. Reject any question if the correct answer is wrong, more than one option could be correct, required information is missing, the puzzle is ambiguous, the Tamil and English versions differ in meaning, the explanation conflicts with the answer, or it is trivia/current-affairs rather than reasoning. Also reject near-duplicates that test the same underlying puzzle structure as another item in this batch. Accept only questions that are genuinely solvable and suitable for Medium or Hard difficulty. Return ONLY JSON: {\"acceptedNumbers\":[1,2,...]}.\n\nQUESTIONS:\n${JSON.stringify(compact)}`;
    const parsed = await this.gemini(prompt, false, 5000) as { acceptedNumbers?: number[] };
    const accepted = new Set((parsed.acceptedNumbers ?? []).filter((n) => Number.isInteger(n)));
    return questions.filter((_, i) => accepted.has(i + 1));
  }

  private async generateQuestionsForBrainChallenge(previousQuestions: string[]): Promise<GeneratedQuestion[]> {
    const parsed = await this.gemini(brainPrompt(previousQuestions), false, 12000) as { questions?: GeneratedQuestion[] };
    const shaped = this.validateBrainQuestionShape((parsed.questions ?? []).slice(0, QUESTIONS_PER_DAY));
    if (shaped.length < QUESTIONS_PER_DAY) return shaped;
    return this.reviewBrainChallengeQuestions(shaped);
  }

  // Backward-compatible entry point for the existing protected admin route.
  async generateDailyBatch(subCategoryId?: string) {
    if (subCategoryId === 'BRAIN_CHALLENGE') return this.generateBrainChallenge();
    return this.generateDailyQuiz();
  }
}

export const dailyCurrentAffairsService = new DailyCurrentAffairsService();