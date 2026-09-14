// Bulk Explanation Generator (Sept 2026, scoped to Group IV first per
// Phased Launch). See schema.prisma's own header comment on
// ExplanationGenerationRun for why this is BATCHED (multiple questions
// per Gemini call), unlike AI Question Audit's one-at-a-time design --
// a direct, admin-requested lesson from that feature's real cost
// overrun (see question-audit.service.ts's own pricing-constant fix).
//
// Reuses the same retry/fallback Gemini pattern established in
// question-audit.service.ts (own copy here, not a shared import --
// matching this codebase's "provider-specific logic isolated per
// concern" convention, same reasoning question-audit.service.ts's own
// header comment gives for not sharing with ai/classification.service.ts).

import { Prisma, ExplanationRunStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';
// Sept 2026 (BUG FIX applied here from day one) — real Gemini 3.7 Flash
// pricing verified against Google's own pricing page: $0.75/M input,
// $3.75/M output, through the introductory period ending Dec 31, 2026.
const EST_INPUT_COST_PER_1M = 0.75;
const EST_OUTPUT_COST_PER_1M = 3.75;

// Questions per Gemini call. Amortizes the fixed instruction overhead
// across several questions instead of repeating it per-question (the
// audit's real cost lesson) -- 8 keeps each prompt/response a
// reasonable size without risking a truncated JSON response.
const BATCH_SIZE = 8;

interface BatchExplanation {
  id: string;
  explanationTa: string;
  explanationEn: string;
}

export class BulkExplanationService {
  private async fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3, delayMs = 2000): Promise<Response> {
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, init);
      if (response.ok) return response;
      const bodyText = await response.text();
      const isRetryable = response.status === 503 || (response.status === 429 && !bodyText.includes('prepayment credits'));
      if (!isRetryable || attempt === maxAttempts - 1) {
        return new Response(bodyText, { status: response.status, statusText: response.statusText });
      }
      lastResponse = response;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return lastResponse!;
  }

  private async fetchWithFallback(prompt: string): Promise<{ response: Response; model: string }> {
    const requestFor = (model: string) => ({
      model,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4000, responseMimeType: 'application/json' },
        }),
      } satisfies RequestInit,
    });
    const primary = requestFor(GEMINI_MODEL);
    const primaryResponse = await this.fetchWithRetry(primary.url, primary.init);
    if (primaryResponse.ok || primaryResponse.status !== 503) {
      return { response: primaryResponse, model: GEMINI_MODEL };
    }
    const fallback = requestFor(GEMINI_MODEL_FALLBACK);
    return { response: await this.fetchWithRetry(fallback.url, fallback.init, 1), model: GEMINI_MODEL_FALLBACK };
  }

  /** Sept 2026 — same DISTINCT+random() Postgres restriction fixed in
   * question-audit.service.ts's selectSampleForSubCategory() (commit
   * 22b36ac) -- subquery wrap avoided here from the start. */
  async selectMissingExplanationQuestions(subCategoryId: string, targetSize: number): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM (
          SELECT DISTINCT q.id FROM "Question" q
          LEFT JOIN "QuestionTaxonomyTag" t ON t."questionId" = q.id
          WHERE q.status = 'PUBLISHED'
            AND (q."subCategoryId" = ${subCategoryId} OR t."subCategoryId" = ${subCategoryId})
            AND (q."explanationTa" IS NULL OR q."explanationEn" IS NULL)
        ) matched
        ORDER BY random()
        LIMIT ${targetSize}
      `,
    );
    return rows.map((r) => r.id);
  }

  async createRun(label: string, subCategoryId: string, questionIds: string[]) {
    return prisma.explanationGenerationRun.create({
      data: { label, subCategoryId, questionIds, totalQuestions: questionIds.length },
    });
  }

  private buildBatchPrompt(
    questions: { id: string; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string }[],
  ): string {
    const questionsText = questions
      .map((q, i) => {
        const correctText = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[q.correctOption as 'A' | 'B' | 'C' | 'D'];
        return `Question ${i + 1} (id: ${q.id}):\n${q.questionText}\nOptions: A) ${q.optionA}  B) ${q.optionB}  C) ${q.optionC}  D) ${q.optionD}\nCorrect answer: ${q.correctOption}) ${correctText}`;
      })
      .join('\n\n');

    return `You are writing exam-prep explanations for TNPSC Group - IV (Tamil Nadu) competitive exam questions. For EACH question below, write a concise, accurate explanation of why the correct answer is correct (2-4 sentences), in BOTH Tamil and English. Never invent facts you're not confident about -- if the topic is genuinely uncertain, write a shorter, more general explanation rather than a confident but possibly wrong one.

${questionsText}

Respond with ONLY a JSON array, one object per question in the same order, each with exactly these fields: "id" (the question's id exactly as given above), "explanationTa" (Tamil), "explanationEn" (English). No markdown fences, no other text.`;
  }

  async processRun(runId: string): Promise<void> {
    const run = await prisma.explanationGenerationRun.findUniqueOrThrow({ where: { id: runId } });
    if (run.status !== 'RUNNING') return;

    const alreadyDone = run.processedQuestions;
    const remainingIds = run.questionIds.slice(alreadyDone);

    try {
      for (let i = 0; i < remainingIds.length; i += BATCH_SIZE) {
        const stillRunning = await prisma.explanationGenerationRun.findUnique({ where: { id: runId }, select: { status: true } });
        if (stillRunning?.status !== 'RUNNING') return;

        const batchIds = remainingIds.slice(i, i + BATCH_SIZE);
        const questions = await prisma.question.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOption: true },
        });
        if (questions.length === 0) continue;

        const prompt = this.buildBatchPrompt(questions);
        try {
          const { response, model } = await this.fetchWithFallback(prompt);
          if (!response.ok) {
            console.error(`Bulk explanation batch failed (run ${runId}): ${response.status} ${await response.text()}`);
            await prisma.explanationGenerationRun.update({ where: { id: runId }, data: { processedQuestions: { increment: batchIds.length } } });
            continue;
          }
          const data = (await response.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          };
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
          let parsed: BatchExplanation[] = [];
          try {
            parsed = JSON.parse(rawText.replace(/^```json\s*|\s*```$/g, ''));
          } catch (e) {
            console.error(`Bulk explanation JSON parse failed (run ${runId}):`, rawText.slice(0, 500));
          }

          await prisma.$transaction([
            ...parsed
              .filter((p) => p.id && p.explanationTa && p.explanationEn)
              .map((p) => prisma.question.update({ where: { id: p.id }, data: { explanationTa: p.explanationTa, explanationEn: p.explanationEn } })),
            prisma.explanationGenerationRun.update({
              where: { id: runId },
              data: {
                processedQuestions: { increment: batchIds.length },
                inputTokens: { increment: data.usageMetadata?.promptTokenCount ?? 0 },
                outputTokens: { increment: data.usageMetadata?.candidatesTokenCount ?? 0 },
                model,
              },
            }),
          ]);
        } catch (err) {
          console.error(`Bulk explanation batch crashed (run ${runId}):`, err);
          await prisma.explanationGenerationRun.update({ where: { id: runId }, data: { processedQuestions: { increment: batchIds.length } } });
        }
      }

      const finalRun = await prisma.explanationGenerationRun.findUniqueOrThrow({ where: { id: runId } });
      await prisma.explanationGenerationRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED' as ExplanationRunStatus,
          completedAt: new Date(),
          estimatedCostUsd: (finalRun.inputTokens / 1_000_000) * EST_INPUT_COST_PER_1M + (finalRun.outputTokens / 1_000_000) * EST_OUTPUT_COST_PER_1M,
        },
      });
    } catch (err) {
      console.error(`Bulk explanation run ${runId} crashed:`, err);
      await prisma.explanationGenerationRun.update({
        where: { id: runId },
        data: { status: 'FAILED' as ExplanationRunStatus, completedAt: new Date(), errorMessage: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  async cancelRun(runId: string): Promise<void> {
    await prisma.explanationGenerationRun.update({
      where: { id: runId },
      data: { status: 'FAILED' as ExplanationRunStatus, completedAt: new Date(), errorMessage: 'Cancelled by admin.' },
    });
  }

  async listRuns() {
    return prisma.explanationGenerationRun.findMany({ orderBy: { startedAt: 'desc' } });
  }

  /** Sept 2026 — admin requested: a real quality-check view of what a
   * run actually generated, not just its progress stats. Returns the
   * run's own questionIds (fixed at creation) with their current
   * question text and explanations -- reflects the LATEST content even
   * if something else touched the question since (e.g. AI Question
   * Audit's own auto-apply), which is the honest, current state to show
   * an admin doing a quality check. */
  async getRunQuestions(runId: string) {
    const run = await prisma.explanationGenerationRun.findUniqueOrThrow({ where: { id: runId } });
    const questions = await prisma.question.findMany({
      where: { id: { in: run.questionIds } },
      select: { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOption: true, explanationTa: true, explanationEn: true },
    });
    // Preserve the run's own original question order rather than
    // whatever order the database happens to return.
    const byId = new Map(questions.map((q) => [q.id, q]));
    return run.questionIds.map((id) => byId.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
  }

  /** Resume any run left RUNNING by an interrupted server process --
   * same pattern as question-audit.service.ts's resumeStaleRuns(),
   * called once at server startup. */
  async resumeStaleRuns(): Promise<void> {
    const staleRuns = await prisma.explanationGenerationRun.findMany({ where: { status: 'RUNNING' } });
    for (const run of staleRuns) {
      this.processRun(run.id).catch((err) => console.error(`Failed to resume explanation run ${run.id}:`, err));
    }
  }
}

export const bulkExplanationService = new BulkExplanationService();
