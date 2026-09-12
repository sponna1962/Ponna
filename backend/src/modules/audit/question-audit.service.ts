// AI Question Quality Audit — Phase 1 pilot (Sept 2026, BINDING).
//
// Structural safety guarantee: this file NEVER calls prisma.question.update
// / updateMany / delete on the Question model. It only reads Question and
// writes to QuestionAuditRun / QuestionAuditRunItem / QuestionAuditFlag.
// "AI must only identify and flag possible problems, never change/delete/
// disable/publish a question" is therefore enforced by what this service
// literally has no code path to do, not just by convention. Admin acts on
// confirmed flags through the EXISTING question edit flow.
//
// Reuses the Gemini REST-API + retry/fallback pattern already established
// in ai/classification.service.ts (same GEMINI_API_KEY, same 503/429
// retry-then-fallback-model behaviour) — intentionally NOT a shared
// abstraction with that file, matching this codebase's "provider-specific
// logic isolated per concern" convention elsewhere (see gemini-adapter.ts).

import { Prisma, AuditIssueType, AuditVerdict, AuditRunStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { findDuplicateCandidates } from './duplicate-prefilter';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';

// Rough, approximate per-flash-model pricing (USD per 1M tokens) — for the
// pilot's cost dashboard only, NOT a substitute for checking the actual
// Google AI Studio / Cloud Billing console. Update if Google's published
// pricing changes; this is deliberately a loose estimate, not a billing
// source of truth.
const EST_INPUT_COST_PER_1M = 0.075;
const EST_OUTPUT_COST_PER_1M = 0.3;

interface RawFlag {
  issueType: string;
  verdict?: string;
  confidence: number;
  notes: string;
  duplicateOfIndex?: number; // index into the candidates list passed in the prompt
  resolvedDuplicateId?: string;
  crossExamIndex?: number; // index into the cross-exam candidates list, for CROSS_EXAM_APPLICABLE only
  resolvedCrossExamSubCategoryId?: string;
}

interface AuditCallResult {
  flags: RawFlag[];
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}

export class QuestionAuditService {
  private async fetchWithRetry(url: string, init: RequestInit, maxAttempts = 2): Promise<Response> {
    const delayMs = 2000;
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
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

  private buildPrompt(
    question: {
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: string;
      explanationTa: string | null;
      explanationEn: string | null;
      language: string;
      difficulty: string | null;
      authority?: { name: string } | null;
      examCategory?: { name: string } | null;
      subCategory?: { name: string } | null;
    },
    candidates: { index: number; questionText: string }[],
    crossExamCandidates: { index: number; name: string; topics: string[] }[] = [],
  ): string {
    const examContext = question.authority
      ? `Exam mapping: ${question.authority.name}${question.examCategory ? ' — ' + question.examCategory.name : ''}${question.subCategory ? ' — ' + question.subCategory.name : ''}`
      : 'Exam mapping: none tagged';

    const candidateBlock =
      candidates.length > 0
        ? `\n\nPossible near-duplicate candidates (same exam scope, textually similar) — check if the question is a near-duplicate of any of these:\n${candidates.map((c) => `[${c.index}] ${c.questionText}`).join('\n')}`
        : '';

    // Sept 2026 — Phase 1, admin-approved, low-risk scope: only ever
    // compares against OTHER exams sharing the SAME admin-set
    // standardGroup as this question's own exam (e.g. both "SSLC") —
    // comparing across different standards risks a difficulty mismatch
    // even when the topic matches, so that's deliberately never offered
    // as a candidate here at all (filtered before this prompt is built).
    const crossExamBlock =
      crossExamCandidates.length > 0
        ? `\n\nOther exams at the SAME qualification standard as this question's own exam, with their syllabus topics — check if this question's content would ALSO genuinely fit any of these (same subject matter AND same difficulty level, not just a loosely related topic):\n${crossExamCandidates.map((c) => `[${c.index}] ${c.name} — topics: ${c.topics.join(', ') || '(no topics listed)'}`).join('\n')}`
        : '';

    return `You are auditing ONE competitive-exam practice question for quality issues. You are a careful reviewer, NOT an editor — you only report problems, you never rewrite or correct anything.

${examContext}
Difficulty currently set: ${question.difficulty ?? 'not set'}
Language: ${question.language}

Question: ${question.questionText}
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}
Marked correct answer: ${question.correctOption}
Explanation (Tamil): ${question.explanationTa ?? '(none provided)'}
Explanation (English): ${question.explanationEn ?? '(none provided)'}${candidateBlock}${crossExamBlock}

Check for ALL of the following, independently — a question can have zero, one, or several genuine issues:
- WRONG_ANSWER: the marked correct option is actually wrong
- MULTIPLE_CORRECT_OPTIONS: more than one option could be defended as correct
- UNCLEAR_OR_INVALID_QUESTION: the question is ambiguous, malformed, or unanswerable as written
- WRONG_EXPLANATION: the explanation is incorrect, contradicts the marked answer, or is missing when it shouldn't be
- LANGUAGE_ISSUE: a genuine Tamil/English grammar, spelling, or translation error (not just an awkward-but-correct phrasing)
- LIKELY_DUPLICATE: only if candidates were given above and this question is substantially the same as one of them — reference it by its [index]
- WRONG_MAPPING: the exam/category/sub-category mapping above looks wrong for this question's actual content (this is a claim the CURRENT tag is a mistake — different from CROSS_EXAM_APPLICABLE below)
- WRONG_DIFFICULTY: the difficulty level set is clearly miscalibrated for the stated exam
- FACTUAL_CONCERN: a factual claim in the question, options, or explanation may be incorrect. If you cannot reliably verify this either way from your own knowledge, still report it — use verdict "CANNOT_VERIFY" rather than staying silent. Do NOT skip this category just because you found nothing else wrong.
- CROSS_EXAM_APPLICABLE: only if cross-exam candidates were given above and this question's content genuinely fits one of them (same topic AND same standard/level) — this is ADDITIVE, never a claim the existing tag is wrong. Reference the exam by its [index]. Be conservative — only flag this when you're genuinely confident the fit is good, not just topically adjacent.

Rules:
- Report EACH issue you find as its OWN separate entry — never combine multiple issues into one entry.
- Only include an entry for a category if you genuinely believe there's a concern (or, for FACTUAL_CONCERN specifically, cannot verify it) — do not include categories with no concern.
- "confidence" (0-100) is YOUR confidence in that specific flag being correct — it does not trigger any action, it is shown to a human reviewer as-is.
- verdict is "LIKELY_ISSUE" for a problem you believe is real, or "CANNOT_VERIFY" ONLY for FACTUAL_CONCERN cases you cannot confidently resolve.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"flags": [{"issueType": "<one of: WRONG_ANSWER, MULTIPLE_CORRECT_OPTIONS, UNCLEAR_OR_INVALID_QUESTION, WRONG_EXPLANATION, LANGUAGE_ISSUE, LIKELY_DUPLICATE, WRONG_MAPPING, WRONG_DIFFICULTY, FACTUAL_CONCERN, CROSS_EXAM_APPLICABLE>", "verdict": "LIKELY_ISSUE or CANNOT_VERIFY", "confidence": <0-100 integer>, "notes": "<one or two short sentences explaining the concern>", "duplicateOfIndex": <only for LIKELY_DUPLICATE, the [index] number from the candidates list above>, "crossExamIndex": <only for CROSS_EXAM_APPLICABLE, the [index] number from the cross-exam candidates list above>}]}
If there are no concerns at all, respond with {"flags": []}.`;
  }

  private async callAudit(questionId: string): Promise<AuditCallResult> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set — AI audit is unavailable until this is configured.');
    }

    const question = await prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: { authority: true, examCategory: true, subCategory: true },
    });

    const candidateRows = await findDuplicateCandidates({
      id: question.id,
      questionText: question.questionText,
      subCategoryId: question.subCategoryId,
      categoryId: question.categoryId,
      language: question.language,
    });
    const candidates = candidateRows.map((c, i) => ({ index: i, questionText: c.questionText, id: c.id }));

    // Sept 2026 — Cross-Exam Question Tagging (Phase 1, admin-approved,
    // low-risk scope). Only ever compares within the SAME admin-set
    // standardGroup — a null standardGroup on this question's own
    // Sub-Category means it hasn't been classified yet, so no cross-exam
    // comparison is offered at all (safer to skip than guess).
    let crossExamCandidates: { index: number; name: string; topics: string[]; subCategoryId: string }[] = [];
    if (question.subCategory?.standardGroup) {
      const otherSubCategories = await prisma.examSubCategory.findMany({
        where: {
          standardGroup: question.subCategory.standardGroup,
          id: { not: question.subCategory.id },
          studentVisible: true,
        },
        include: { syllabusSubjects: { include: { topics: { select: { name: true }, take: 15 } } } },
        take: 10, // keep the prompt bounded even if a standardGroup ends up with many Sub-Categories
      });
      crossExamCandidates = otherSubCategories.map((sc, i) => ({
        index: i,
        name: sc.name,
        topics: sc.syllabusSubjects.flatMap((s) => s.topics.map((t) => t.name)).slice(0, 20),
        subCategoryId: sc.id,
      }));
    }

    const prompt = this.buildPrompt(question, candidates, crossExamCandidates);
    const { response, model } = await this.fetchWithFallback(prompt);

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const finishReason = data.candidates?.[0]?.finishReason;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    let parsed: { flags: RawFlag[] };
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      const hint = finishReason === 'MAX_TOKENS' ? ' (response was cut off — increase maxOutputTokens)' : '';
      throw new Error(`Could not parse AI audit response${hint}: ${text.slice(0, 200)}`);
    }

    // Resolve duplicateOfIndex / crossExamIndex back to real ids before
    // returning — keeps the candidate-index indirection entirely inside
    // this function.
    const flags = (parsed.flags ?? []).map((f) => {
      if (f.issueType === 'LIKELY_DUPLICATE' && typeof f.duplicateOfIndex === 'number') {
        const match = candidates.find((c) => c.index === f.duplicateOfIndex);
        return { ...f, duplicateOfIndex: undefined, resolvedDuplicateId: match?.id };
      }
      if (f.issueType === 'CROSS_EXAM_APPLICABLE' && typeof f.crossExamIndex === 'number') {
        const match = crossExamCandidates.find((c) => c.index === f.crossExamIndex);
        return { ...f, crossExamIndex: undefined, resolvedCrossExamSubCategoryId: match?.subCategoryId };
      }
      return f;
    });

    return {
      flags,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      modelUsed: model,
    };
  }

  /** Random-sampled, exam-priority-weighted selection for the pilot — never
   * EASY (PONNA has no Easy tier), PUBLISHED only. 70% TNPSC / 20% TNTET /
   * 10% other visible authorities, per the approved Phase 1 plan; each
   * bucket is a true Postgres-side random sample (ORDER BY random()), not
   * a JS-side shuffle of a huge fetched list. */
  async selectStratifiedSample(targetSize: number): Promise<string[]> {
    const tnpsc = await prisma.examAuthority.findFirst({ where: { name: 'TNPSC' } });
    const tntet = await prisma.examAuthority.findFirst({ where: { name: 'TNTET' } });

    const tnpscCount = tnpsc ? Math.round(targetSize * 0.7) : 0;
    const tntetCount = tntet ? Math.round(targetSize * 0.2) : 0;
    const otherCount = Math.max(0, targetSize - tnpscCount - tntetCount);

    const excludeIds = [tnpsc?.id, tntet?.id].filter((x): x is string => !!x);

    const randomIds = async (authorityId: string | null, limit: number): Promise<string[]> => {
      if (limit <= 0) return [];
      const rows = authorityId
        ? await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM "Question" WHERE status = 'PUBLISHED' AND difficulty IN ('MEDIUM','HARD') AND "authorityId" = ${authorityId} ORDER BY random() LIMIT ${limit}`,
          )
        : await prisma.$queryRaw<{ id: string }[]>(
            excludeIds.length > 0
              ? Prisma.sql`SELECT id FROM "Question" WHERE status = 'PUBLISHED' AND difficulty IN ('MEDIUM','HARD') AND ("authorityId" IS NULL OR "authorityId" NOT IN (${Prisma.join(excludeIds)})) ORDER BY random() LIMIT ${limit}`
              : Prisma.sql`SELECT id FROM "Question" WHERE status = 'PUBLISHED' AND difficulty IN ('MEDIUM','HARD') ORDER BY random() LIMIT ${limit}`,
          );
      return rows.map((r) => r.id);
    };

    const ids = [
      ...(await randomIds(tnpsc?.id ?? null, tnpscCount)),
      ...(await randomIds(tntet?.id ?? null, tntetCount)),
      ...(await randomIds(null, otherCount)),
    ];

    return [...new Set(ids)];
  }

  /** Creates the run row and returns it immediately — processing happens
   * separately via processRun (fire-and-forget from the route), so the
   * admin gets a runId to poll right away instead of waiting on 1,000
   * sequential Gemini calls before seeing anything. */
  async createRun(label: string, questionIds: string[], createdByStaffId?: string) {
    return prisma.questionAuditRun.create({
      data: {
        label,
        totalQuestions: questionIds.length,
        model: GEMINI_MODEL,
        createdByStaffId,
      },
    });
  }

  /** Sequential by design (mirrors classification.service.ts's own bulk
   * job) — a 1,000-question pilot run doesn't need to be fast, and
   * sequential calls are far gentler on Gemini's rate limits than firing
   * all 1,000 at once. A single question's failure is logged and skipped,
   * never aborts the whole run. */
  async processRun(runId: string, questionIds: string[]): Promise<void> {
    try {
      for (const questionId of questionIds) {
        try {
          const result = await this.callAudit(questionId);

          await prisma.$transaction([
            prisma.questionAuditRunItem.create({
              data: { runId, questionId, flagCount: result.flags.length },
            }),
            ...result.flags.map((f) =>
              prisma.questionAuditFlag.create({
                data: {
                  runId,
                  questionId,
                  issueType: f.issueType as AuditIssueType,
                  verdict: (f.verdict === 'CANNOT_VERIFY' ? 'CANNOT_VERIFY' : 'LIKELY_ISSUE') as AuditVerdict,
                  confidence: Math.max(0, Math.min(100, Math.round(f.confidence))),
                  aiNotes: f.notes,
                  duplicateOfQuestionIds: f.resolvedDuplicateId ? [f.resolvedDuplicateId] : [],
                  suggestedAdditionalSubCategoryId: f.resolvedCrossExamSubCategoryId ?? null,
                },
              }),
            ),
            prisma.questionAuditRun.update({
              where: { id: runId },
              data: {
                processedQuestions: { increment: 1 },
                flaggedQuestions: { increment: result.flags.length > 0 ? 1 : 0 },
                totalFlags: { increment: result.flags.length },
                inputTokens: { increment: result.inputTokens },
                outputTokens: { increment: result.outputTokens },
                model: result.modelUsed,
              },
            }),
          ]);
        } catch (err) {
          console.error(`Question audit failed for ${questionId}:`, err);
          await prisma.questionAuditRun.update({
            where: { id: runId },
            data: { processedQuestions: { increment: 1 } },
          });
        }
      }

      const run = await prisma.questionAuditRun.findUniqueOrThrow({ where: { id: runId } });
      const estimatedCostUsd =
        (run.inputTokens / 1_000_000) * EST_INPUT_COST_PER_1M + (run.outputTokens / 1_000_000) * EST_OUTPUT_COST_PER_1M;

      await prisma.questionAuditRun.update({
        where: { id: runId },
        data: { status: 'COMPLETED' as AuditRunStatus, completedAt: new Date(), estimatedCostUsd },
      });
    } catch (err) {
      await prisma.questionAuditRun.update({
        where: { id: runId },
        data: { status: 'FAILED' as AuditRunStatus, completedAt: new Date(), errorMessage: (err as Error).message },
      });
    }
  }
}

export const questionAuditService = new QuestionAuditService();
