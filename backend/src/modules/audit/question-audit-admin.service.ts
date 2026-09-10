// Admin-facing reads/actions for the AI Question Audit (Sept 2026 pilot).
// Deliberately separate from question-audit.service.ts (which does the
// actual AI calls) — this file only ever touches QuestionAuditRun/
// RunItem/Flag rows, plus READS Question for display. Reviewing a flag
// here (Confirm/Dismiss) never edits the Question itself — the admin uses
// the existing question edit flow for that, separately.

import { AuditFlagStatus, AuditIssueType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class QuestionAuditAdminService {
  async listRuns() {
    return prisma.questionAuditRun.findMany({ orderBy: { startedAt: 'desc' } });
  }

  async getRun(runId: string) {
    const run = await prisma.questionAuditRun.findUniqueOrThrow({ where: { id: runId } });
    const byIssueType = await prisma.questionAuditFlag.groupBy({
      by: ['issueType'],
      where: { runId },
      _count: { _all: true },
    });
    const byStatus = await prisma.questionAuditFlag.groupBy({
      by: ['status'],
      where: { runId },
      _count: { _all: true },
    });
    return { run, byIssueType, byStatus };
  }

  async listFlags(filters: { runId?: string; issueType?: AuditIssueType; status?: AuditFlagStatus }, cursor?: string, take = 30) {
    const flags = await prisma.questionAuditFlag.findMany({
      where: {
        ...(filters.runId ? { runId: filters.runId } : {}),
        ...(filters.issueType ? { issueType: filters.issueType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
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
    return flags;
  }

  async reviewFlag(flagId: string, status: 'CONFIRMED' | 'DISMISSED', staffId: string, note?: string) {
    return prisma.questionAuditFlag.update({
      where: { id: flagId },
      data: { status: status as AuditFlagStatus, reviewedByStaffId: staffId, reviewedAt: new Date(), reviewNote: note ?? null },
    });
  }
}

export const questionAuditAdminService = new QuestionAuditAdminService();
