// AI Classification Service — implements §9 (AI-Assisted Difficulty
// Classification Workflow):
//   Draft upload → AI suggests difficulty + confidence
//     → confidence >= threshold → auto-publish
//     → confidence <  threshold → stays Draft, lands in "Needs Review" queue
//
// Uses the Google Gemini API directly. Requires GEMINI_API_KEY in the
// environment — this is a real account/credential you provide (see README).

import { PrismaClient, Difficulty, QuestionStatus } from '@prisma/client';

const prisma = new PrismaClient();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.6-flash'; // fast + cheap, appropriate for a per-question classification call

interface ClassificationResult {
  difficulty: Difficulty;
  confidence: number; // 0–100
  reasoning: string;
}

export class ClassificationService {
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // A generous token budget — this model spends some of it on hidden
          // internal reasoning before producing the actual JSON answer, so
          // a tight limit truncates the response before it completes.
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        }),
      },
    );

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
  async classifyPendingQuestions(sourceBatchId?: string): Promise<{ processed: number; autoPublished: number; needsReview: number }> {
    const pending = await prisma.question.findMany({
      where: {
        status: QuestionStatus.DRAFT,
        aiSuggestedDifficulty: null,
        ...(sourceBatchId ? { sourceBatchId } : {}),
      },
    });

    let autoPublished = 0;
    let needsReview = 0;

    for (const q of pending) {
      try {
        const { autoPublished: published } = await this.classifyAndApply(q.id);
        published ? autoPublished++ : needsReview++;
      } catch (err) {
        console.error(`Classification failed for question ${q.id}:`, err);
        needsReview++; // failed classification also lands in the review queue, not silently dropped
      }

      // Gentle pacing to avoid rate-limit bursts on large batches.
      await new Promise((r) => setTimeout(r, 200));
    }

    return { processed: pending.length, autoPublished, needsReview };
  }

  /** Classifies a specific list of question ids (used by the admin panel's "Classify Selected" bulk action). */
  async classifyQuestionIds(ids: string[]): Promise<{ processed: number; autoPublished: number; needsReview: number }> {
    let autoPublished = 0;
    let needsReview = 0;

    for (const id of ids) {
      try {
        const { autoPublished: published } = await this.classifyAndApply(id);
        published ? autoPublished++ : needsReview++;
      } catch (err) {
        console.error(`Classification failed for question ${id}:`, err);
        needsReview++;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return { processed: ids.length, autoPublished, needsReview };
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
