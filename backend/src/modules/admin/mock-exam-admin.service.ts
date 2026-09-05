// Live Exam / Mock Exam — admin configuration (finalized requirement).
// Real exam pattern (question count, duration, marking scheme), verified
// against the official notification, never guessed.

import { prisma } from '../../lib/prisma';

export class MockExamAdminService {
  async getConfig(subCategoryId: string) {
    return prisma.mockExamConfig.findUnique({ where: { subCategoryId } });
  }

  async upsertConfig(
    subCategoryId: string,
    data: { questionCount: number; durationMinutes: number; marksPerQuestion: number; negativeMarkingFraction: number; sourceUrl?: string; verifiedAt: string },
  ) {
    return prisma.mockExamConfig.upsert({
      where: { subCategoryId },
      create: {
        subCategoryId,
        questionCount: data.questionCount,
        durationMinutes: data.durationMinutes,
        marksPerQuestion: data.marksPerQuestion,
        negativeMarkingFraction: data.negativeMarkingFraction,
        sourceUrl: data.sourceUrl?.trim() || null,
        verifiedAt: new Date(data.verifiedAt),
      },
      update: {
        questionCount: data.questionCount,
        durationMinutes: data.durationMinutes,
        marksPerQuestion: data.marksPerQuestion,
        negativeMarkingFraction: data.negativeMarkingFraction,
        sourceUrl: data.sourceUrl?.trim() || null,
        verifiedAt: new Date(data.verifiedAt),
      },
    });
  }

  async deleteConfig(subCategoryId: string) {
    await prisma.mockExamConfig.delete({ where: { subCategoryId } }).catch(() => {});
  }
}
