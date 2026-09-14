// Subject Classification (Sept 2026, Group IV first). See
// schema.prisma's own header comment on SubjectClassificationRun for
// the full context -- a real, admin-confirmed problem: the existing
// ~1370 Group IV questions are tagged with 7 legacy Subject names that
// are bulk-import batch/source labels, not actual content topics.
//
// Batched (8 questions/call, same lesson as bulk-explanation.service.ts
// and AI Question Audit's own batching fix), confidence-gated auto-apply
// (a classification above the threshold applies directly and is logged
// for reversibility; one below it is left for manual review) -- this is
// a one-time bulk cleanup, not an ongoing quality process, so there's no
// separate admin "confirm" step for the ones that already met the bar.

import { Prisma, SubjectClassificationRunStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';
const EST_INPUT_COST_PER_1M = 0.75;
const EST_OUTPUT_COST_PER_1M = 3.75;

const BATCH_SIZE = 8;
// A classification below this is left for manual review rather than
// applied automatically -- deliberately the SAME bar AI Question
// Audit's own Confidence-Threshold Auto-Apply uses, for consistency.
const AUTO_APPLY_CONFIDENCE_THRESHOLD = 85;

interface RawClassification {
  questionIndex: number;
  subjectName: string;
  confidence: number;
  notes?: string;
}

export class SubjectClassificationService {
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 3000, responseMimeType: 'application/json' },
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

  /** Same DISTINCT+subquery pattern already fixed for scoped audit
   * sampling (22b36ac) -- selects questions currently tagged to any of
   * the OLD legacy Subjects for this exam (or untagged), so this can be
   * run repeatedly and pick up whatever hasn't been reclassified yet
   * (it excludes questions already tagged to one of the 8 official
   * Subjects, since those don't need reclassifying). */
  async selectQuestionsNeedingClassification(subCategoryId: string, officialSubjectIds: string[], targetSize: number): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM (
          SELECT DISTINCT q.id FROM "Question" q
          LEFT JOIN "QuestionTaxonomyTag" t ON t."questionId" = q.id
          WHERE q.status = 'PUBLISHED'
            AND (q."subCategoryId" = ${subCategoryId} OR t."subCategoryId" = ${subCategoryId})
            AND (q."subjectId" IS NULL OR q."subjectId" NOT IN (${Prisma.join(officialSubjectIds.length > 0 ? officialSubjectIds : [''])}))
        ) matched
        ORDER BY random()
        LIMIT ${targetSize}
      `,
    );
    return rows.map((r) => r.id);
  }

  async createRun(label: string, subCategoryId: string, questionIds: string[]) {
    return prisma.subjectClassificationRun.create({
      data: { label, subCategoryId, questionIds, totalQuestions: questionIds.length },
    });
  }

  private buildBatchPrompt(
    questions: { id: string; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string }[],
    officialSubjects: { name: string }[],
  ): string {
    const subjectList = officialSubjects.map((s) => `- ${s.name}`).join('\n');
    const questionBlocks = questions
      .map((q, i) => `Question ${i} (id: ${q.id}):\n${q.questionText}\nA. ${q.optionA}  B. ${q.optionB}  C. ${q.optionC}  D. ${q.optionD}`)
      .join('\n\n');

    return `You are classifying TNPSC Group - IV competitive-exam questions by content topic. Each question below must be assigned to EXACTLY ONE of these official syllabus subjects, based on what the question is actually testing:

${subjectList}

${questionBlocks}

For EACH question, pick the single best-fitting subject from the list above (exact name, character for character) and give your confidence (0-100) that this is correct. If a question genuinely could fit more than one subject, pick whichever is the PRIMARY topic being tested, and lower your confidence accordingly rather than guessing.

Respond with ONLY a JSON object, no markdown fences:
{"results": [{"questionIndex": <0-indexed Question N number>, "subjectName": "<exact name from the list above>", "confidence": <0-100 integer>, "notes": "<one short sentence>"}]}
Include an entry for EVERY question above, even if confidence is low -- never skip one.`;
  }

  async processRun(runId: string): Promise<void> {
    try {
      const run = await prisma.subjectClassificationRun.findUniqueOrThrow({ where: { id: runId } });
      const officialSubjects = await prisma.subject.findMany({ where: { subCategoryId: run.subCategoryId }, select: { id: true, name: true } });
      if (officialSubjects.length === 0) {
        throw new Error('No official Subjects exist for this exam yet -- run "Set Up 8 Official Group IV Subjects" first.');
      }
      const subjectByName = new Map(officialSubjects.map((s) => [s.name, s.id]));

      const alreadyDone = run.processedQuestions;
      const remainingIds = run.questionIds.slice(alreadyDone);

      for (let i = 0; i < remainingIds.length; i += BATCH_SIZE) {
        const stillRunning = await prisma.subjectClassificationRun.findUnique({ where: { id: runId }, select: { status: true } });
        if (stillRunning?.status !== 'RUNNING') return;

        const batchIds = remainingIds.slice(i, i + BATCH_SIZE);
        const questions = await prisma.question.findMany({
          where: { id: { in: batchIds } },
          select: { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, subjectId: true, subject: { select: { name: true } } },
        });
        if (questions.length === 0) continue;

        try {
          const prompt = this.buildBatchPrompt(questions, officialSubjects);
          const { response, model } = await this.fetchWithFallback(prompt);
          if (!response.ok) {
            console.error(`Subject classification batch failed (run ${runId}): ${response.status} ${await response.text()}`);
            await prisma.subjectClassificationRun.update({ where: { id: runId }, data: { processedQuestions: { increment: batchIds.length } } });
            continue;
          }
          const data = (await response.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          };
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
          let parsed: { results: RawClassification[] } = { results: [] };
          try {
            parsed = JSON.parse(rawText.replace(/^```json\s*|\s*```$/g, ''));
          } catch {
            console.error(`Subject classification JSON parse failed (run ${runId}):`, rawText.slice(0, 500));
          }

          let autoApplied = 0;
          let needsReview = 0;
          for (const r of parsed.results ?? []) {
            const question = questions[r.questionIndex];
            if (!question) continue;
            const suggestedSubjectId = subjectByName.get(r.subjectName);
            if (!suggestedSubjectId) continue; // AI returned a name not in our list -- skip rather than guess

            const confidence = Math.max(0, Math.min(100, Math.round(r.confidence)));
            const shouldApply = confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD;

            await prisma.$transaction([
              prisma.subjectClassificationResult.create({
                data: {
                  runId,
                  questionId: question.id,
                  previousSubjectId: question.subjectId,
                  previousSubjectName: question.subject?.name ?? null,
                  suggestedSubjectId,
                  confidence,
                  aiNotes: r.notes,
                  applied: shouldApply,
                },
              }),
              ...(shouldApply ? [prisma.question.update({ where: { id: question.id }, data: { subjectId: suggestedSubjectId } })] : []),
            ]);
            if (shouldApply) autoApplied++;
            else needsReview++;
          }

          await prisma.subjectClassificationRun.update({
            where: { id: runId },
            data: {
              processedQuestions: { increment: batchIds.length },
              autoAppliedCount: { increment: autoApplied },
              needsReviewCount: { increment: needsReview },
              inputTokens: { increment: data.usageMetadata?.promptTokenCount ?? 0 },
              outputTokens: { increment: data.usageMetadata?.candidatesTokenCount ?? 0 },
              model,
            },
          });
        } catch (err) {
          console.error(`Subject classification batch crashed (run ${runId}):`, err);
          await prisma.subjectClassificationRun.update({ where: { id: runId }, data: { processedQuestions: { increment: batchIds.length } } });
        }
      }

      const finalRun = await prisma.subjectClassificationRun.findUniqueOrThrow({ where: { id: runId } });
      await prisma.subjectClassificationRun.update({
        where: { id: runId },
        data: {
          status: 'COMPLETED' as SubjectClassificationRunStatus,
          completedAt: new Date(),
          estimatedCostUsd: (finalRun.inputTokens / 1_000_000) * EST_INPUT_COST_PER_1M + (finalRun.outputTokens / 1_000_000) * EST_OUTPUT_COST_PER_1M,
        },
      });
    } catch (err) {
      console.error(`Subject classification run ${runId} crashed:`, err);
      await prisma.subjectClassificationRun.update({
        where: { id: runId },
        data: { status: 'FAILED' as SubjectClassificationRunStatus, completedAt: new Date(), errorMessage: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  async cancelRun(runId: string): Promise<void> {
    await prisma.subjectClassificationRun.update({
      where: { id: runId },
      data: { status: 'FAILED' as SubjectClassificationRunStatus, completedAt: new Date(), errorMessage: 'Cancelled by admin.' },
    });
  }

  async listRuns() {
    return prisma.subjectClassificationRun.findMany({ orderBy: { startedAt: 'desc' } });
  }

  /** Results needing manual review for a run (confidence below the
   * auto-apply threshold) -- an admin can inspect and manually apply
   * via applyResult() below. */
  async getResultsNeedingReview(runId: string) {
    return prisma.subjectClassificationResult.findMany({
      where: { runId, applied: false },
      include: { question: { select: { questionText: true, optionA: true, optionB: true, optionC: true, optionD: true } }, suggestedSubject: { select: { name: true } } },
      orderBy: { confidence: 'desc' },
    });
  }

  /** Manual apply for a below-threshold suggestion an admin has reviewed
   * and agrees with. */
  async applyResult(resultId: string): Promise<void> {
    const result = await prisma.subjectClassificationResult.findUniqueOrThrow({ where: { id: resultId } });
    await prisma.$transaction([
      prisma.question.update({ where: { id: result.questionId }, data: { subjectId: result.suggestedSubjectId } }),
      prisma.subjectClassificationResult.update({ where: { id: resultId }, data: { applied: true } }),
    ]);
  }

  async resumeStaleRuns(): Promise<void> {
    const staleRuns = await prisma.subjectClassificationRun.findMany({ where: { status: 'RUNNING' } });
    for (const run of staleRuns) {
      this.processRun(run.id).catch((err) => console.error(`Failed to resume subject-classification run ${run.id}:`, err));
    }
  }
}

export const subjectClassificationService = new SubjectClassificationService();
