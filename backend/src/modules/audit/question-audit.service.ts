// AI Question Quality Audit — Phase 1 pilot (Sept 2026, BINDING).
//
// Structural guarantee (UPDATED Sept 2026 — Confidence-Threshold
// Auto-Apply, admin-approved after reviewing 5,000 real flagged
// questions): this file itself NEVER calls prisma.question.update
// directly — it only ever writes to QuestionAuditRun / RunItem / Flag.
// The one deliberate exception is delegated entirely to
// question-audit-admin.service.ts's tryAutoApply(), called right after
// each flag is created below: a flag with a structured fix, above an
// admin-set confidence threshold (or any confidence for the additive
// CROSS_EXAM_APPLICABLE tag), is applied automatically, with a
// before/after audit trail (AutoApplyLog) for every field changed.
// UNCLEAR_OR_INVALID_QUESTION never auto-applies regardless of
// confidence — always requires a human, since a full question rewrite
// can change intent far more than a single-field fix. Everything else
// (no structured fix, or below threshold) is left OPEN for the admin's
// existing manual review flow, unchanged.
//
// Reuses the Gemini REST-API + retry/fallback pattern already established
// in ai/classification.service.ts (same GEMINI_API_KEY, same 503/429
// retry-then-fallback-model behaviour) — intentionally NOT a shared
// abstraction with that file, matching this codebase's "provider-specific
// logic isolated per concern" convention elsewhere (see gemini-adapter.ts).

import { Prisma, AuditIssueType, AuditVerdict, AuditRunStatus, CorrectOption, Difficulty } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { findDuplicateCandidates } from './duplicate-prefilter';
import { questionAuditAdminService } from './question-audit-admin.service';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';

// Rough, approximate per-flash-model pricing (USD per 1M tokens) — for the
// pilot's cost dashboard only, NOT a substitute for checking the actual
// Google AI Studio / Cloud Billing console. Update if Google's published
// pricing changes; this is deliberately a loose estimate, not a billing
// source of truth.
// Sept 2026 (BUG FIX) — was $0.075/$0.30 per 1M tokens, roughly 10x
// too low. Real Gemini 3.7 Flash pricing (verified against Google's
// own pricing page, Sept 2026): $0.75/M input, $3.75/M output, through
// the introductory period ending Dec 31, 2026 (standard rate $1.50/$7.50
// applies from Jan 1, 2027 -- update these constants again then).
const EST_INPUT_COST_PER_1M = 0.75;
const EST_OUTPUT_COST_PER_1M = 3.75;

interface RawFlag {
  issueType: string;
  verdict?: string;
  confidence: number;
  notes: string;
  duplicateOfIndex?: number; // index into the candidates list passed in the prompt
  resolvedDuplicateId?: string;
  crossExamIndex?: number; // index into the cross-exam candidates list, for CROSS_EXAM_APPLICABLE only
  resolvedCrossExamSubCategoryId?: string;
  suggestedCorrectOption?: string; // only for WRONG_ANSWER
  suggestedQuestionText?: string;
  suggestedExplanationTa?: string;
  suggestedExplanationEn?: string;
  suggestedDifficulty?: string;
}

interface AuditCallResult {
  flags: RawFlag[];
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}

// Sept 2026 (real cost lesson, admin-requested) — batched audit calls,
// same reasoning as bulk-explanation.service.ts's own header comment:
// repeating the same lengthy instructions per-question wastes input
// tokens; batching amortizes that overhead across several questions per
// call. Smaller batch than bulk-explanation's 8 (this schema is richer
// per question -- multiple possible flags, several optional
// suggested* fields each -- so a smaller batch keeps response size and
// truncation risk manageable).
const AUDIT_BATCH_SIZE = 4;

interface QuestionAuditContext {
  id: string;
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
  candidates: { index: number; questionText: string; id: string }[];
  crossExamCandidates: { index: number; name: string; topics: string[]; subCategoryId: string }[];
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

  /** Random-sampled, exam-priority-weighted selection for the pilot — never
   * EASY (PONNA has no Easy tier), PUBLISHED only. 70% TNPSC / 20% TNTET /
   * 10% other visible authorities, per the approved Phase 1 plan; each
   * bucket is a true Postgres-side random sample (ORDER BY random()), not
   * a JS-side shuffle of a huge fetched list. */
  /** Sept 2026 (fix — real progress across repeated runs, not random
   * overlap) — every question ALREADY covered by any past run (any
   * status) is excluded here, so calling this repeatedly (e.g. "5,000
   * now, another 5,000 once this finishes") genuinely advances through
   * the whole bank instead of the pure `ORDER BY random()` this
   * previously was, which had no memory of what was already sampled and
   * could re-pick the same questions indefinitely while others were
   * never reached at all. */
  /** Sept 2026 (Phased Launch, admin-requested) — scopes the sample to
   * ONE specific Sub-Category (e.g. Group IV) instead of the usual
   * TNPSC/TNTET/Other stratification, for when the priority is
   * thoroughly auditing exactly what's about to launch rather than
   * spreading coverage across the whole bank. Same "exclude already-
   * audited" and PUBLISHED+Medium/Hard filters as the stratified
   * method; no cross-authority backfill needed here since there's only
   * one target scope. Same OR pattern (direct subCategoryId OR
   * authorityTags) allocation.service.ts/mock-exam.service.ts already
   * use, so this picks up the same question set Practice/Live Exam
   * would actually serve for this exam. */
  async selectSampleForSubCategory(subCategoryId: string, targetSize: number): Promise<string[]> {
    const alreadyAuditedRows = await prisma.questionAuditRunItem.findMany({ select: { questionId: true }, distinct: ['questionId'] });
    const alreadyAuditedIds = alreadyAuditedRows.map((r) => r.questionId);
    const excludeAuditedSql = alreadyAuditedIds.length > 0 ? Prisma.sql`AND q.id NOT IN (${Prisma.join(alreadyAuditedIds)})` : Prisma.empty;

    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        SELECT id FROM (
          SELECT DISTINCT q.id FROM "Question" q
          LEFT JOIN "QuestionTaxonomyTag" t ON t."questionId" = q.id
          WHERE q.status = 'PUBLISHED' AND q.difficulty IN ('MEDIUM','HARD')
            AND (q."subCategoryId" = ${subCategoryId} OR t."subCategoryId" = ${subCategoryId})
            ${excludeAuditedSql}
        ) matched
        ORDER BY random()
        LIMIT ${targetSize}
      `,
    );
    return rows.map((r) => r.id);
  }

  async selectStratifiedSample(targetSize: number): Promise<string[]> {
    const tnpsc = await prisma.examAuthority.findFirst({ where: { name: 'TNPSC' } });
    const tntet = await prisma.examAuthority.findFirst({ where: { name: 'TNTET' } });

    const tnpscCount = tnpsc ? Math.round(targetSize * 0.7) : 0;
    const tntetCount = tntet ? Math.round(targetSize * 0.2) : 0;
    const otherCount = Math.max(0, targetSize - tnpscCount - tntetCount);

    const excludeIds = [tnpsc?.id, tntet?.id].filter((x): x is string => !!x);

    const alreadyAuditedRows = await prisma.questionAuditRunItem.findMany({ select: { questionId: true }, distinct: ['questionId'] });
    const alreadyAuditedIds = alreadyAuditedRows.map((r) => r.questionId);
    const excludeAuditedSql = (extra: string[]) => {
      const all = [...alreadyAuditedIds, ...extra];
      return all.length > 0 ? Prisma.sql`AND id NOT IN (${Prisma.join(all)})` : Prisma.empty;
    };

    const randomIds = async (authorityId: string | null, limit: number, extraExclude: string[] = []): Promise<string[]> => {
      if (limit <= 0) return [];
      const rows = authorityId
        ? await prisma.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM "Question" WHERE status = 'PUBLISHED' AND difficulty IN ('MEDIUM','HARD') AND "authorityId" = ${authorityId} ${excludeAuditedSql(extraExclude)} ORDER BY random() LIMIT ${limit}`,
          )
        : await prisma.$queryRaw<{ id: string }[]>(
            excludeIds.length > 0
              ? Prisma.sql`SELECT id FROM "Question" WHERE status = 'PUBLISHED' AND difficulty IN ('MEDIUM','HARD') AND ("authorityId" IS NULL OR "authorityId" NOT IN (${Prisma.join(excludeIds)})) ${excludeAuditedSql(extraExclude)} ORDER BY random() LIMIT ${limit}`
              : Prisma.sql`SELECT id FROM "Question" WHERE status = 'PUBLISHED' AND difficulty IN ('MEDIUM','HARD') ${excludeAuditedSql(extraExclude)} ORDER BY random() LIMIT ${limit}`,
          );
      return rows.map((r) => r.id);
    };

    const tnpscIds = await randomIds(tnpsc?.id ?? null, tnpscCount);
    const tntetIds = await randomIds(tntet?.id ?? null, tntetCount);
    const otherIds = await randomIds(null, otherCount);

    // Sept 2026 (fix — backfill short buckets from TNPSC) — a smaller
    // exam's authority (TNTET, or "Other") can run out of eligible,
    // not-yet-audited questions well before TNPSC does, since TNPSC's own
    // bank is far larger. Previously a bucket coming up short just meant
    // fewer total questions than requested (e.g. asking for 10 with a
    // 70/20/10 split returned only 7 if TNTET and Other had nothing
    // left). Any shortfall is now backfilled from TNPSC (excluding the
    // TNPSC ids already picked above), so the returned count matches
    // targetSize whenever the OVERALL bank still has that many eligible,
    // not-yet-audited questions somewhere.
    const shortfall = tnpscCount - tnpscIds.length + (tntetCount - tntetIds.length) + (otherCount - otherIds.length);
    const backfillIds = tnpsc && shortfall > 0 ? await randomIds(tnpsc.id, shortfall, tnpscIds) : [];

    const ids = [...tnpscIds, ...tntetIds, ...otherIds, ...backfillIds];

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
        questionIds,
      },
    });
  }

  /** Sept 2026 — re-audits the EXACT same questions a past run covered,
   * with whatever the CURRENT prompt/schema captures (e.g. the
   * structured suggestedCorrectOption added after the original pilot
   * run predated it). Deliberately bypasses selectStratifiedSample()'s
   * own "exclude already-audited" exclusion (7e34652) -- that exclusion
   * is for fresh sampling making forward progress through the bank;
   * this is an intentional, explicit re-audit of a SPECIFIC prior batch,
   * not random sampling. Old flags from the original run are left
   * untouched (both sets simply coexist); the new run's flags are what
   * carry the newer structured data going forward. */
  async createReRunFromPastRun(previousRunId: string, label: string, createdByStaffId?: string) {
    const previousRun = await prisma.questionAuditRun.findUniqueOrThrow({ where: { id: previousRunId } });
    return this.createRun(label, previousRun.questionIds, createdByStaffId);
  }

  /** Sequential by design (mirrors classification.service.ts's own bulk
   * job) — a 1,000-question pilot run doesn't need to be fast, and
   * sequential calls are far gentler on Gemini's rate limits than firing
   * all 1,000 at once. A single question's failure is logged and skipped,
   * never aborts the whole run.
   *
   * Sept 2026 (resilience) — now only takes runId. Recomputes the
   * REMAINING question ids itself (run.questionIds minus whatever
   * QuestionAuditRunItem rows already exist for this run) rather than
   * being handed a fixed list — this is what makes resumeStaleRuns()
   * safe to call blindly on every server startup: calling this again for
   * an already-fully-processed run just finds zero remaining and
   * completes immediately, a harmless no-op. */
  async processRun(runId: string): Promise<void> {
    try {
      const runRecord = await prisma.questionAuditRun.findUniqueOrThrow({ where: { id: runId } });
      const alreadyProcessed = await prisma.questionAuditRunItem.findMany({ where: { runId }, select: { questionId: true } });
      const alreadyProcessedIds = new Set(alreadyProcessed.map((i) => i.questionId));
      const remainingQuestionIds = runRecord.questionIds.filter((id) => !alreadyProcessedIds.has(id));

      // Sept 2026 — batched (AUDIT_BATCH_SIZE questions per Gemini call),
      // real cost lesson (see this class's own AUDIT_BATCH_SIZE comment).
      // Chunking preserves every existing per-question guarantee below
      // (its own create-transaction, its own auto-apply attempt, its own
      // error isolation) -- only the Gemini CALL itself is now shared
      // across a chunk, not each question's own database writes.
      for (let chunkStart = 0; chunkStart < remainingQuestionIds.length; chunkStart += AUDIT_BATCH_SIZE) {
        const chunk = remainingQuestionIds.slice(chunkStart, chunkStart + AUDIT_BATCH_SIZE);

        // Sept 2026 — Cancel Run: same check as before, now once per
        // BATCH rather than once per question (worst case a cancel takes
        // up to AUDIT_BATCH_SIZE questions longer to take effect, an
        // acceptable trade-off at this batch size).
        const stillRunning = await prisma.questionAuditRun.findUnique({ where: { id: runId }, select: { status: true } });
        if (stillRunning?.status !== 'RUNNING') {
          console.log(`Question audit run ${runId} stopped mid-loop (status is now ${stillRunning?.status}).`);
          return;
        }

        let batchResults: Map<string, AuditCallResult>;
        try {
          batchResults = await this.callAuditBatch(chunk);
        } catch (err) {
          // Whole-batch failure (e.g. Gemini API error) -- mark every
          // question in this chunk processed-with-no-result, same
          // resilience guarantee the old per-question catch gave: one
          // bad call never stops the run, just skips what it covered.
          console.error(`Question audit batch failed for [${chunk.join(', ')}]:`, err);
          await prisma.questionAuditRun.update({ where: { id: runId }, data: { processedQuestions: { increment: chunk.length } } });
          continue;
        }

        for (const questionId of chunk) {
          const result = batchResults.get(questionId) ?? { flags: [], inputTokens: 0, outputTokens: 0, modelUsed: GEMINI_MODEL };
          try {
            const txResults = await prisma.$transaction([
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
                    suggestedCorrectOption: ['A', 'B', 'C', 'D'].includes(f.suggestedCorrectOption ?? '') ? (f.suggestedCorrectOption as CorrectOption) : null,
                    suggestedQuestionText: f.suggestedQuestionText ?? null,
                    suggestedExplanationTa: f.suggestedExplanationTa ?? null,
                    suggestedExplanationEn: f.suggestedExplanationEn ?? null,
                    suggestedDifficulty: ['MEDIUM', 'HARD'].includes(f.suggestedDifficulty ?? '') ? (f.suggestedDifficulty as Difficulty) : null,
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

            // Sept 2026 — Confidence-Threshold Auto-Apply (admin-approved):
            // right after each flag is safely created, immediately check
            // whether it's eligible to apply itself (see
            // question-audit-admin.service.ts's tryAutoApply() for the
            // exact rule). Deliberately a SEPARATE step after the create
            // transaction commits, not inside it -- keeps the create logic
            // and the apply logic independently readable, and a failure
            // here (e.g. one flag's field update erroring) never rolls
            // back the flags/run-item that were already safely recorded.
            const createdFlagIds = (txResults.slice(1, 1 + result.flags.length) as { id: string }[]).map((f) => f.id);
            for (const flagId of createdFlagIds) {
              try {
                await questionAuditAdminService.tryAutoApply(flagId);
              } catch (err) {
                console.error(`Auto-apply failed for flag ${flagId}:`, err);
              }
            }
          } catch (err) {
            console.error(`Question audit failed for ${questionId}:`, err);
            await prisma.questionAuditRun.update({
              where: { id: runId },
              data: { processedQuestions: { increment: 1 } },
            });
          }
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

  /** Sept 2026 (resilience) — called once on every server startup (see
   * scheduled-jobs.ts). Finds any run still marked RUNNING (meaning the
   * server process died mid-run last time — e.g. a deploy restarting the
   * dyno — before it ever reached the COMPLETED/FAILED update) and
   * resumes each one via the SAME processRun(), which itself recomputes
   * "remaining" from questionIds minus already-processed items — so this
   * genuinely continues from exactly where it left off, never re-doing
   * (and re-billing) work already done. Fire-and-forget per run, exactly
   * like a fresh run's own kickoff — this function itself returns as
   * soon as resumption has been kicked off, not when it completes. */
  /** Sept 2026 — used only by the re-audit route (bypasses the
   * questionIds-excluded-from-admin-API bandwidth optimization in
   * question-audit-admin.service.ts, since this genuinely needs the
   * full list). Falls back to reconstructing the list from
   * QuestionAuditRunItem when questionIds is empty (default [] on the
   * column) -- this covers every run created BEFORE the resumability
   * fix (e1a6e3a) started populating questionIds at creation time,
   * including the original 700-question pilot: QuestionAuditRunItem
   * rows existed independently of that column from the very start,
   * since processRun() has always created one per processed question. */
  async getRunQuestionIds(runId: string): Promise<string[]> {
    const run = await prisma.questionAuditRun.findUniqueOrThrow({ where: { id: runId }, select: { questionIds: true } });
    if (run.questionIds.length > 0) return run.questionIds;
    const items = await prisma.questionAuditRunItem.findMany({ where: { runId }, select: { questionId: true } });
    return items.map((i) => i.questionId);
  }

  /** Sept 2026 — admin-triggered stop for a run that's stuck failing
   * repeatedly (e.g. Gemini billing depleted, confirmed from a real
   * production case). Sets status to FAILED with a clear note; the
   * in-flight processRun() loop (if the same server process is still
   * alive) notices this at its next per-question check and returns
   * immediately. Also prevents resumeStaleRuns() from picking this run
   * back up on a future server restart, since it's no longer RUNNING. */
  async cancelRun(runId: string): Promise<void> {
    await prisma.questionAuditRun.update({
      where: { id: runId },
      data: { status: 'FAILED' as AuditRunStatus, completedAt: new Date(), errorMessage: 'Cancelled by admin.' },
    });
  }

  async resumeStaleRuns(): Promise<void> {
    const staleRuns = await prisma.questionAuditRun.findMany({ where: { status: 'RUNNING' as AuditRunStatus } });
    for (const run of staleRuns) {
      console.log(`[startup] Resuming interrupted AI Question Audit run "${run.label}" (${run.processedQuestions}/${run.totalQuestions} already done)`);
      this.processRun(run.id).catch((err) => console.error(`[startup] Failed to resume audit run ${run.id}:`, err));
    }
  }
}

export const questionAuditService = new QuestionAuditService();
