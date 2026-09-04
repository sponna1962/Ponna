// Verified Exam Facts — admin management (finalized requirement, Ask
// Ponna Exam Preparation Coach flow). Admin-maintained, source-and-date
// stamped facts about one specific TNPSC exam. This is the data the
// get_exam_info tool reads from — never anything the AI infers itself.

import { prisma } from '../../lib/prisma';

export class ExamFactsService {
  async listForExam(subCategoryId: string) {
    return prisma.verifiedExamFact.findMany({
      where: { subCategoryId },
      orderBy: [{ factType: 'asc' }, { verifiedAt: 'desc' }],
    });
  }

  async create(subCategoryId: string, data: { factType: string; value: string; sourceUrl?: string; verifiedAt: string }) {
    return prisma.verifiedExamFact.create({
      data: {
        subCategoryId,
        factType: data.factType as any,
        value: data.value.trim(),
        sourceUrl: data.sourceUrl?.trim() || null,
        verifiedAt: new Date(data.verifiedAt),
      },
    });
  }

  async update(id: string, data: { value?: string; sourceUrl?: string; verifiedAt?: string }) {
    return prisma.verifiedExamFact.update({
      where: { id },
      data: {
        ...(data.value !== undefined ? { value: data.value.trim() } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl.trim() || null } : {}),
        ...(data.verifiedAt !== undefined ? { verifiedAt: new Date(data.verifiedAt) } : {}),
      },
    });
  }

  async delete(id: string) {
    await prisma.verifiedExamFact.delete({ where: { id } });
  }
}
