// AI Classification Service — implements §9 (AI-Assisted Difficulty
// Classification Workflow):
//   Draft upload → AI suggests difficulty + confidence
//     → confidence >= threshold → auto-publish
//     → confidence <  threshold → stays Draft, lands in "Needs Review" queue
//
// Uses the Google Gemini API directly. Requires GEMINI_API_KEY in the
// environment — this is a real account/credential you provide (see README).

import { Difficulty, QuestionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash'; // primary — fast + cheap, appropriate for a per-question classification call
// If the primary model keeps returning 503 (overloaded — common right
// after a new model's GA release absorbs a demand spike), fall back to a
// slightly older but confirmed-stable model rather than failing outright.
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';

interface ClassificationResult {
  difficulty: Difficulty;
  confidence: number; // 0–100
  reasoning: string;
}

export class ClassificationService {
  /**
   * Calls the Gemini API, automatically retrying ONLY on 503 (model
   * temporarily overloaded — Google's own error message says "usually
   * temporary, try again later") and 429 (rate limit, not the "prepayment
   * credits depleted" billing case — that one is also 429 but never
   * resolves by waiting, so it's excluded by checking the message text).
   * Everything else (400 bad request, 401/403 invalid key, billing
   * depleted) fails immediately — retrying those would just waste time and
   * API calls without ever succeeding.
   *
   * Kept deliberately short (1 retry, 2s wait) — a bulk "Classify Selected"
   * run processes many questions one at a time, so a long per-question
   * retry ladder here multiplies into a very slow overall run. A quick
   * single retry catches most momentary blips; sustained overload is
   * handled by falling back to a different model instead (see below), not
   * by waiting longer on the same one.
   */
  private async fetchWithRetry(url: string, init: RequestInit, maxAttempts = 2): Promise<Response> {
    const delayMs = 2000;
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, init);
      if (response.ok) return response;

      const bodyText = await response.text();
      const isRetryable = response.status === 503 || (response.status === 429 && !bodyText.includes('prepayment credits'));
      if (!isRetryable || attempt === maxAttempts - 1) {
        // Reconstruct a Response-like object carrying the body we already
        // consumed, so the caller's `await response.text()` still works.
        return new Response(bodyText, { status: response.status, statusText: response.statusText });
      }

      lastResponse = response;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return lastResponse!;
  }

  /**
   * Tries the primary model (with its own quick 503/429 retry above); if it
   * STILL fails with 503 — meaning the primary model itself is under
   * sustained heavy load, not just a momentary blip — falls back to a
   * different, confirmed-stable model with a SINGLE attempt (no further
   * retry there) to keep a bulk run moving. Non-503 failures (bad request,
   * invalid key, billing) are NOT retried with the fallback model either —
   * switching models can't fix those.
   */
  private async fetchWithFallback(prompt: string): Promise<Response> {
    const requestFor = (model: string) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // A generous token budget — this model spends some of it on hidden
          // internal reasoning before producing the actual JSON answer, so
          // a tight limit truncates the response before it completes.
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        }),
      } satisfies RequestInit,
    });

    const primary = requestFor(GEMINI_MODEL);
    const primaryResponse = await this.fetchWithRetry(primary.url, primary.init);
    if (primaryResponse.ok || primaryResponse.status !== 503) {
      return primaryResponse;
    }

    const fallback = requestFor(GEMINI_MODEL_FALLBACK);
    return this.fetchWithRetry(fallback.url, fallback.init, 1);
  }

  /**
   * Classifies a single question via the Gemini API. The prompt includes
   * exam type/sub-type context, since "Medium" for TNPSC Group 4 and "Medium"
   * for UPSC are not the same bar (§9).
   */
  async classifyQuestion(questionId: string): Promise<ClassificationResult> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set — AI classification is unavailable until this is configured.');
    }

    const question = await prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: { authority: true, examCategory: true, subCategory: true },
    });

    const examContext = question.authority
      ? `Exam: ${question.authority.name}${question.examCategory ? ' — ' + question.examCategory.name : ''}${question.subCategory ? ' — ' + question.subCategory.name : ''}`
      : 'Exam: General competitive exam (no specific authority tagged)';

    const prompt = `You are classifying a competitive-exam practice question as MEDIUM or HARD difficulty, calibrated to the exam context given.

${examContext}

Question: ${question.questionText}
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}
Correct answer: ${question.correctOption}

Guidance:
- MEDIUM = general knowledge / standard exam-level difficulty for this exam type
- HARD = requires deeper/specialized knowledge, multi-step reasoning, or is a level above typical exam questions for this exam type
- Calibrate to the specific exam named above, not a universal standard

Respond with ONLY a JSON object, no other text, no markdown fences:
{"difficulty": "MEDIUM" or "HARD", "confidence": <0-100 integer>, "reasoning": "<one short sentence>"}`;

    const response = await this.fetchWithFallback(prompt);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const finishReason = data.candidates?.[0]?.finishReason;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    // Extract the {...} block even if the model added stray text or markdown
    // fences around it — more forgiving than requiring the whole string to be valid JSON.
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    let parsed: { difficulty: string; confidence: number; reasoning: string };
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      const hint = finishReason === 'MAX_TOKENS' ? ' (response was cut off — increase maxOutputTokens)' : '';
      throw new Error(`Could not parse AI classification response${hint}: ${text.slice(0, 200)}`);
    }

    return {
      difficulty: parsed.difficulty === 'HARD' ? Difficulty.HARD : Difficulty.MEDIUM,
      confidence: Math.max(0, Math.min(100, parsed.confidence)),
      reasoning: parsed.reasoning,
    };
  }

  /**
   * Classifies one question and persists the result immediately, applying the
   * confidence threshold (auto-publish above, leave as Draft below). Shared by
   * both the single-question "Classify" button and the batch job below.
   */
  async classifyAndApply(questionId: string): Promise<ClassificationResult & { autoPublished: boolean }> {
    const settings = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 'singleton' } });
    const result = await this.classifyQuestion(questionId);
    const autoPublished = result.confidence >= settings.aiConfidenceThreshold;

    const original = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, select: { translationGroupId: true } });

    const updateData = {
      aiSuggestedDifficulty: result.difficulty,
      aiConfidence: result.confidence,
      ...(autoPublished ? { difficulty: result.difficulty, status: QuestionStatus.PUBLISHED } : {}),
    };

    // Finalized requirement: Tamil/English versions of the same question
    // must share the same Difficulty and PerformanceBucket — classifying
    // one language applies the result to BOTH linked rows, not just the one
    // that was actually sent to the AI. Avoids a Tamil/English fairness gap
    // in ranking, and avoids classifying (and paying for) both languages
    // separately when they're the same underlying question.
    if (original.translationGroupId) {
      await prisma.question.updateMany({ where: { translationGroupId: original.translationGroupId }, data: updateData });
    } else {
      await prisma.question.update({ where: { id: questionId }, data: updateData });
    }

    return { ...result, autoPublished };
  }

  /**
   * Classifies every Draft question that hasn't been classified yet
   * (optionally scoped to one upload batch), and applies the confidence
   * threshold: auto-publish above threshold, leave for manual review below.
   * Runs sequentially with a small delay to stay well under API rate limits —
   * for large batches in production, swap this for a proper queue/worker.
   */
  async classifyPendingQuestions(sourceBatchId?: string): Promise<{ processed: number; autoPublished: number; needsReview: number; failed: number }> {
    const pending = await prisma.question.findMany({
      where: {
        status: QuestionStatus.DRAFT,
        aiSuggestedDifficulty: null,
        ...(sourceBatchId ? { sourceBatchId } : {}),
      },
    });

    let autoPublished = 0;
    let needsReview = 0;
    let failed = 0;

    for (const q of pending) {
      try {
        const { autoPublished: published } = await this.classifyAndApply(q.id);
        published ? autoPublished++ : needsReview++;
      } catch (err) {
        // A genuine API/parsing failure — distinct from "classified
        // successfully but confidence was too low to auto-publish". Nothing
        // was persisted for this question (aiSuggestedDifficulty stays
        // null), so it will NOT actually appear in getNeedsReviewQueue()
        // even though earlier code lumped it into that count and made it
        // look like a normal review case rather than a broken call.
        console.error(`Classification failed for question ${q.id}:`, err);
        failed++;
      }

      // Gentle pacing to avoid rate-limit bursts on large batches.
      await new Promise((r) => setTimeout(r, 200));
    }

    return { processed: pending.length, autoPublished, needsReview, failed };
  }

  /** Classifies a specific list of question ids (used by the admin panel's "Classify Selected" bulk action). */
  async classifyQuestionIds(ids: string[]): Promise<{ processed: number; autoPublished: number; needsReview: number; failed: number }> {
    let autoPublished = 0;
    let needsReview = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const { autoPublished: published } = await this.classifyAndApply(id);
        published ? autoPublished++ : needsReview++;
      } catch (err) {
        console.error(`Classification failed for question ${id}:`, err);
        failed++;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return { processed: ids.length, autoPublished, needsReview, failed };
  }

  /** The Needs Review queue: drafts that were classified but fell below threshold, or weren't auto-published. */
  async getNeedsReviewQueue() {
    return prisma.question.findMany({
      where: {
        status: QuestionStatus.DRAFT,
        aiSuggestedDifficulty: { not: null },
      },
      orderBy: { aiConfidence: 'asc' }, // lowest-confidence (most uncertain) first
    });
  }

  /**
   * Accuracy dashboard data (§7.3): of questions where an admin has since set
   * a final difficulty different from the AI's suggestion, how often did the
   * AI get overridden? Computed on the fly rather than a separate log table —
   * simple enough at this scale, and always consistent with current data.
   */
  async getAccuracyStats() {
    const classified = await prisma.question.findMany({
      where: { aiSuggestedDifficulty: { not: null }, difficulty: { not: null } },
      select: { aiSuggestedDifficulty: true, difficulty: true, aiConfidence: true },
    });

    const total = classified.length;
    const matched = classified.filter((q) => q.aiSuggestedDifficulty === q.difficulty).length;
    const overridden = total - matched;

    return {
      totalClassified: total,
      matchedAdminDecision: matched,
      overriddenByAdmin: overridden,
      agreementRate: total > 0 ? (matched / total) * 100 : null,
    };
  }
}
