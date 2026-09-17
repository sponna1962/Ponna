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
// AFTER AI generation as a second hard gate. It prevents a question created
// today from being emitted again tomorrow even if the model ignores the
// prompt. Whitespace/case/punctuation-only changes are treated as duplicates.
function normalizeQuestion(text: string): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[.,!?;:'\"“”‘’()\[\]{}<>/\\|\-–—_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function brainPrompt(): string {
  return `Create ${QUESTIONS_PER_DAY} original TNPSC-style Brain Challenge multiple-choice questions for a daily practice quiz. These must test reasoning and problem-solving, NOT current affairs or news. Mix logical reasoning, number patterns, arithmetic reasoning, analytical thinking, ordering/arrangement, age/time/work/clock reasoning, data interpretation, and observation-based reasoning. Avoid trivia, memorisation-only questions, politics/news facts, and ambiguous wordplay.\n\nEvery question must be solvable from the information stated in the question itself. Use exactly four distinct options and exactly one correct answer. Independently solve every problem before returning it. Make distractors plausible near-misses, not random answers. Vary the underlying concepts; do not repeat the same puzzle with different names or numbers. Return both Tamil and English versions with the same meaning, plus a concise explanation in both languages.\n\nReturn ONLY valid JSON in this exact shape:\n{\"questions\":[{\"questionTextTa\":\"...\",\"optionATa\":\"...\",\"optionBTa\":\"...\",\"optionCTa\":\"...\",\"optionDTa\":\"...\",\"questionTextEn\":\"...\",\"optionAEn\":\"...\",\"optionBEn\":\"...\",\"optionCEn\":\"...\",\"optionDEn\":\"...\",\"correctOption\":\"A\",\"explanationTa\":\"...\",\"explanationEn\":\"...\"}]}\n\nQuality rules: exactly ${QUESTIONS_PER_DAY} questions; four options A-D; exactly one correct option; no duplicate or near-duplicate question concepts; no current-affairs facts; no missing conditions; no unsupported assumptions; arithmetic must be checked independently; explanations must agree with the displayed answer.`;
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

    // Never pad with old news. If fewer than 10 fresh, verified events exist,
    // nothing is created. This is the hard guard against stale Current Affairs.
    if (eligible.length < QUESTIONS_PER_DAY) {
      return { created: 0, quizId: null, quizDate, skippedNoResults: true, verification: { step1Discovered: candidates.length, step2Verified: verification.verified.length, rejectedOld: verification.rejectedOld, rejectedUnverified: verification.rejectedUnverified, reason: `Only ${eligible.length} eligible events in the last ${CURRENT_AFFAIRS_WINDOW_HOURS} hours; 10 required. Nothing created.` } };
    }

    const previousQuestions = await this.previousCurrentAffairsQuestions();
    const generatedQuestions = await this.generateCurrentAffairsQuestions(eligible, previousQuestions);
    const questions = this.removeExactPreviousDuplicates(generatedQuestions, previousQuestions);

    // Hard duplicate gate: if AI repeated any previous question, or produced
    // duplicate questions in this batch, the duplicate is removed. We never
    // fill the missing slot with an old question. The quiz is created only
    // when a full set of 10 genuinely new questions remains.
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
    const questions = await this.generateQuestionsForBrainChallenge();
    if (questions.length < QUESTIONS_PER_DAY) throw new Error(`AI generated only ${questions.length} Brain Challenge questions; 10 are required, so nothing was created.`);
    const quiz = await this.createDailyQuiz(quizDate, DailyQuizType.BRAIN_CHALLENGE, questions);
    return { created: quiz.questions.length, quizId: quiz.id, quizDate, skippedNoResults: false };
  }

  private async generateQuestionsForBrainChallenge(): Promise<GeneratedQuestion[]> {
    const parsed = await this.gemini(brainPrompt(), false, 10000) as { questions?: GeneratedQuestion[] };
    return (parsed.questions ?? []).slice(0, QUESTIONS_PER_DAY);
  }

  // Backward-compatible entry point for the existing protected admin route.
  async generateDailyBatch(subCategoryId?: string) {
    if (subCategoryId === 'BRAIN_CHALLENGE') return this.generateBrainChallenge();
    return this.generateDailyQuiz();
  }
}

export const dailyCurrentAffairsService = new DailyCurrentAffairsService();