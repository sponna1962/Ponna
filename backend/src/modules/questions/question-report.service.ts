// Question Reports — student-facing "Report an issue" during practice
// (finalized requirement, content quality control). Flag-only, same
// principle as the suspicious-usage sweep: a report never auto-hides or
// auto-disables a question by itself — a single report could be mistaken,
// so an admin always makes the actual call from the Question Reports page.

import { QuestionReportReason, QuestionReportStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class QuestionReportService {
  async createReport(userId: string, questionId: string, reason: QuestionReportReason, comment?: string) {
    return prisma.questionReport.create({
      data: { userId, questionId, reason, comment: comment?.trim() || null },
    });
  }

  /** Open reports first (what needs attention), newest first within each
   * status — matches the admin page's default "what do I need to look at"
   * use case. */
  async listReports(status?: QuestionReportStatus) {
    return prisma.questionReport.findMany({
      where: status ? { status } : undefined,
      include: {
        question: {
          select: { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOption: true, language: true, status: true },
        },
        user: { select: { name: true, phone: true, email: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async setStatus(id: string, status: QuestionReportStatus) {
    return prisma.questionReport.update({
      where: { id },
      data: { status, resolvedAt: status === QuestionReportStatus.OPEN ? null : new Date() },
    });
  }

  /** Open-report count — for a small badge on the admin nav, same pattern
   * as the "Waiting for AI" count already shown on Questions. */
  async countOpen(): Promise<number> {
    return prisma.questionReport.count({ where: { status: QuestionReportStatus.OPEN } });
  }
}
