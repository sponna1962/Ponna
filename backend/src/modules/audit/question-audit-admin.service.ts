// Admin-facing reads/actions for the AI Question Audit (Sept 2026 pilot).
// Deliberately separate from question-audit.service.ts (which does the
// actual AI calls) — this file only ever touches QuestionAuditRun/
// RunItem/Flag rows, plus READS/writes Question for the two explicit
// exceptions below.
//
// Sept 2026 — Confidence-Threshold Auto-Apply (admin-approved, locked
// design after reviewing 5,000 real flagged questions). A flag with a
// structured fix (suggestedCorrectOption/QuestionText/ExplanationTa/En/
// Difficulty, or a CROSS_EXAM_APPLICABLE tag) is now applied WITHOUT a
// human clicking anything, the moment it's created, PROVIDED:
//   - its issueType is not UNCLEAR_OR_INVALID_QUESTION (never
//     auto-applies, regardless of confidence -- a full question rewrite
//     can change the question's intent far more than a single-field fix,
//     so this always requires manual review), AND
//   - confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD (85), OR the
//     issueType is CROSS_EXAM_APPLICABLE (always eligible regardless of
//     confidence -- additive, never touches the question itself).
// Every automatic field change is logged to AutoApplyLog (before/after,
// per field) before being written, so any pattern of AI error found
// later can be traced and manually undone. This is the ONE deliberate,
// admin-approved exception to "AI Question Audit never touches a
// Question on its own" -- reviewFlag()'s explicit human-click paths
// (Confirm & Apply, CROSS_EXAM_APPLICABLE Confirm) are the other two,
// both unchanged by this addition.

import { AuditFlagStatus, AuditIssueType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const AUTO_APPLY_CONFIDENCE_THRESHOLD = 85;

// issueTypes that NEVER auto-apply regardless of confidence.
const NEVER_AUTO_APPLY: AuditIssueType[] = ['UNCLEAR_OR_INVALID_QUESTION'];

export class QuestionAuditAdminService {
  private static readonly RUN_SELECT = {
    id: true,
    label: true,
    status: true,
    totalQuestions: true,
    processedQuestions: true,
    flaggedQuestions: true,
    totalFlags: true,
    model: true,
    inputTokens: true,
    outputTokens: true,
    estimatedCostUsd: true,
    errorMessage: true,
    startedAt: true,
    completedAt: true,
    createdByStaffId: true,
  } as const;

  async listRuns() {
    return prisma.questionAuditRun.findMany({ orderBy: { startedAt: 'desc' }, select: QuestionAuditAdminService.RUN_SELECT });
  }

  async getRun(runId: string) {
    const run = await prisma.questionAuditRun.findUniqueOrThrow({ where: { id: runId }, select: QuestionAuditAdminService.RUN_SELECT });
    const byIssueType = await prisma.questionAuditFlag.groupBy({ by: ['issueType'], where: { runId }, _count: { _all: true } });
    const byStatus = await prisma.questionAuditFlag.groupBy({ by: ['status'], where: { runId }, _count: { _all: true } });
    return { run, byIssueType, byStatus };
  }

  async listFlags(filters: { runId?: string; issueType?: AuditIssueType; status?: AuditFlagStatus }, cursor?: string, take = 30) {
    return prisma.questionAuditFlag.findMany({
      where: {
        ...(filters.runId ? { runId: filters.runId } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        suggestedAdditionalSubCategory: { select: { name: true } },
        question: {
          select: {
            id: true,
            questionText: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            correctOption: true,
            explanationTa: true,
            explanationEn: true,
            language: true,
            difficulty: true,
            status: true,
            authority: { select: { name: true } },
            examCategory: { select: { name: true } },
            subCategory: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  /** The field-name -> Question-column mapping every apply path (manual
   * or automatic) uses. Returns null if the flag has nothing to apply. */
  private collectFieldChanges(flag: {
    suggestedCorrectOption: string | null;
    suggestedQuestionText: string | null;
    suggestedExplanationTa: string | null;
    suggestedExplanationEn: string | null;
    suggestedDifficulty: string | null;
  }): Record<string, string> | null {
    const data: Record<string, string> = {};
    if (flag.suggestedCorrectOption) data.correctOption = flag.suggestedCorrectOption;
    if (flag.suggestedQuestionText) data.questionText = flag.suggestedQuestionText;
    if (flag.suggestedExplanationTa) data.explanationTa = flag.suggestedExplanationTa;
    if (flag.suggestedExplanationEn) data.explanationEn = flag.suggestedExplanationEn;
    if (flag.suggestedDifficulty) data.difficulty = flag.suggestedDifficulty;
    return Object.keys(data).length > 0 ? data : null;
  }

  private async addAdditionalExamTag(subCategoryId: string, questionId: string) {
    const subCategory = await prisma.examSubCategory.findUniqueOrThrow({ where: { id: subCategoryId }, include: { category: true } });
    const alreadyTagged = await prisma.questionTaxonomyTag.findFirst({ where: { questionId, subCategoryId } });
    if (!alreadyTagged) {
      await prisma.questionTaxonomyTag.create({
        data: { questionId, authorityId: subCategory.category.authorityId, categoryId: subCategory.categoryId, subCategoryId },
      });
    }
  }

  /** Confirm/Dismiss a flag -- the human-click paths. applyAiFix is an
   * explicit ADMIN choice (clicking a button that shows exactly what
   * will change), never the AI acting on its own. */
  async reviewFlag(flagId: string, status: 'CONFIRMED' | 'DISMISSED', staffId: string, note?: string, applyAiFix?: boolean) {
    if (applyAiFix) {
      const flag = await prisma.questionAuditFlag.findUniqueOrThrow({ where: { id: flagId } });
      const data = this.collectFieldChanges(flag);
      if (!data) throw new Error('This flag has no suggested fix to apply.');
      await prisma.question.update({ where: { id: flag.questionId }, data: { ...data, updatedAt: new Date() } });
      await prisma.questionAuditFlag.updateMany({
        where: { questionId: flag.questionId, status: { not: 'DISMISSED' } },
        data: { status: 'DISMISSED', reviewedByStaffId: staffId, reviewedAt: new Date(), reviewNote: note ?? "Auto-dismissed: admin applied the AI's suggested fix." },
      });
      return prisma.questionAuditFlag.findUniqueOrThrow({ where: { id: flagId } });
    }

    const updated = await prisma.questionAuditFlag.update({
      where: { id: flagId },
      data: { status: status as AuditFlagStatus, reviewedByStaffId: staffId, reviewedAt: new Date(), reviewNote: note ?? null },
    });

    if (status === 'CONFIRMED' && updated.issueType === 'CROSS_EXAM_APPLICABLE' && updated.suggestedAdditionalSubCategoryId) {
      await this.addAdditionalExamTag(updated.suggestedAdditionalSubCategoryId, updated.questionId);
    }

    return updated;
  }

  /** Sept 2026 — the automatic path. Called right after a flag is
   * created (question-audit.service.ts's processRun()) AND available for
   * one-time backfill against already-pending flags
   * (backfillAutoApplyPendingFlags() below). Returns true if it applied
   * something, false if the flag wasn't eligible (left OPEN for manual
   * review) -- never throws for an ineligible flag, that's the normal
   * case for most flags. */
  async tryAutoApply(flagId: string): Promise<boolean> {
    const flag = await prisma.questionAuditFlag.findUniqueOrThrow({ where: { id: flagId } });
    if (flag.status !== 'OPEN') return false;
    if (NEVER_AUTO_APPLY.includes(flag.issueType)) return false;

    const isCrossExam = flag.issueType === 'CROSS_EXAM_APPLICABLE' && !!flag.suggestedAdditionalSubCategoryId;
    const fieldChanges = this.collectFieldChanges(flag);
    const eligible = isCrossExam || (fieldChanges !== null && flag.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD);
    if (!eligible) return false;

    if (fieldChanges) {
      const before = await prisma.question.findUniqueOrThrow({
        where: { id: flag.questionId },
        select: { correctOption: true, questionText: true, explanationTa: true, explanationEn: true, difficulty: true },
      });
      await prisma.$transaction([
        prisma.question.update({ where: { id: flag.questionId }, data: { ...fieldChanges, updatedAt: new Date() } }),
        ...Object.keys(fieldChanges).map((field) =>
          prisma.autoApplyLog.create({
            data: {
              flagId: flag.id,
              questionId: flag.questionId,
              field,
              beforeValue: (before as Record<string, unknown>)[field] != null ? String((before as Record<string, unknown>)[field]) : null,
              afterValue: fieldChanges[field],
            },
          }),
        ),
      ]);
    }
    if (isCrossExam) {
      await this.addAdditionalExamTag(flag.suggestedAdditionalSubCategoryId as string, flag.questionId);
    }

    await prisma.questionAuditFlag.update({
      where: { id: flag.id },
      data: { status: 'AUTO_APPLIED', reviewedAt: new Date(), reviewNote: `Auto-applied (confidence ${flag.confidence}% >= ${AUTO_APPLY_CONFIDENCE_THRESHOLD}%).` },
    });
    return true;
  }

  /** Sept 2026 — one-time backfill for flags that were already OPEN
   * before this feature existed (per the admin's explicit "apply to
   * currently-pending flags too" decision). Safe to call repeatedly --
   * tryAutoApply() is itself a no-op for anything not OPEN. */
  async backfillAutoApplyPendingFlags(): Promise<{ checked: number; applied: number }> {
    const pending = await prisma.questionAuditFlag.findMany({ where: { status: 'OPEN' }, select: { id: true } });
    let applied = 0;
    for (const { id } of pending) {
      if (await this.tryAutoApply(id)) applied++;
    }
    return { checked: pending.length, applied };
  }

  /** Sept 2026 — admin-requested daily/weekly visibility: how much is
   * being auto-fixed vs still needing a human, at a glance. */
  async getAutoApplySummary(days = 14): Promise<{ date: string; autoApplied: number; pendingReview: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<{ day: Date; auto_applied: bigint; pending: bigint }[]>(
      Prisma.sql`
        SELECT
          date_trunc('day', "createdAt") AS day,
          COUNT(*) FILTER (WHERE status = 'AUTO_APPLIED') AS auto_applied,
          COUNT(*) FILTER (WHERE status = 'OPEN') AS pending
        FROM "QuestionAuditFlag"
        WHERE "createdAt" >= ${since}
        GROUP BY day
        ORDER BY day DESC
      `,
    );
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), autoApplied: Number(r.auto_applied), pendingReview: Number(r.pending) }));
  }

  /** Sept 2026 — admin-requested full reset before a large fresh run.
   * Deletes AutoApplyLog, QuestionAuditFlag, QuestionAuditRunItem, and
   * QuestionAuditRun (in that order — none of these have ON DELETE
   * CASCADE). NEVER touches Question rows -- only this app's own
   * audit-tracking metadata. Also resets selectStratifiedSample()'s
   * "exclude already-audited questions" memory entirely (it reads from
   * QuestionAuditRunItem) -- an explicit, understood tradeoff the admin
   * confirms before calling this. */
  async deleteAllRuns(): Promise<{ logsDeleted: number; flagsDeleted: number; itemsDeleted: number; runsDeleted: number }> {
    return prisma.$transaction(async (tx) => {
      const logs = await tx.autoApplyLog.deleteMany({});
      const flags = await tx.questionAuditFlag.deleteMany({});
      const items = await tx.questionAuditRunItem.deleteMany({});
      const runs = await tx.questionAuditRun.deleteMany({});
      return { logsDeleted: logs.count, flagsDeleted: flags.count, itemsDeleted: items.count, runsDeleted: runs.count };
    });
  }
}

export const questionAuditAdminService = new QuestionAuditAdminService();
