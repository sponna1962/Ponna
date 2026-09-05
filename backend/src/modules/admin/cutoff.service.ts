// Cut-off Marks Predictor — admin management (finalized requirement).
// Same verify-don't-guess, source-and-date-stamped discipline as
// VerifiedExamFact/Syllabus. No cutoff data is seeded here — real
// historical TNPSC cut-offs must be entered by admin from the official
// published notification for each exam/year/community, never guessed.

import { prisma } from '../../lib/prisma';

export class CutoffService {
  async listForExam(subCategoryId: string) {
    return prisma.cutoffRecord.findMany({
      where: { subCategoryId },
      orderBy: [{ year: 'desc' }, { community: 'asc' }],
    });
  }

  async create(subCategoryId: string, data: { year: number; community: string; cutoffMarks: number; totalMarks?: number; sourceUrl?: string; verifiedAt: string }) {
    return prisma.cutoffRecord.create({
      data: {
        subCategoryId,
        year: data.year,
        community: data.community as any,
        cutoffMarks: data.cutoffMarks,
        totalMarks: data.totalMarks ?? null,
        sourceUrl: data.sourceUrl?.trim() || null,
        verifiedAt: new Date(data.verifiedAt),
      },
    });
  }

  async update(id: string, data: { cutoffMarks?: number; totalMarks?: number; sourceUrl?: string; verifiedAt?: string }) {
    return prisma.cutoffRecord.update({
      where: { id },
      data: {
        ...(data.cutoffMarks !== undefined ? { cutoffMarks: data.cutoffMarks } : {}),
        ...(data.totalMarks !== undefined ? { totalMarks: data.totalMarks } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl.trim() || null } : {}),
        ...(data.verifiedAt !== undefined ? { verifiedAt: new Date(data.verifiedAt) } : {}),
      },
    });
  }

  async delete(id: string) {
    await prisma.cutoffRecord.delete({ where: { id } });
  }
}
