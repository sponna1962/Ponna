// Exam Taxonomy Service — implements §7.1 (Manage Exam Type and Exam Sub-Type).

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class ExamTaxonomyService {
  async listExamTypes() {
    return prisma.examType.findMany({
      include: { subTypes: true, _count: { select: { questions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createExamType(name: string) {
    return prisma.examType.create({ data: { name } });
  }

  async createExamSubType(examTypeId: string, name: string) {
    return prisma.examSubType.create({ data: { examTypeId, name } });
  }

  async deleteExamSubType(id: string) {
    // Questions referencing this sub-type keep their examSubTypeId as null
    // is NOT automatic in Postgres FK terms — in production this should be a
    // soft-disable (an `active` flag) rather than a hard delete, to avoid
    // orphaning question references. Flagged here as a known simplification.
    return prisma.examSubType.delete({ where: { id } });
  }
}
