// Exam Taxonomy Service — implements the 3-level dynamic classification:
//   Authority / Exam Area → Category → Sub-Category (optional)
// Fully replaces the earlier 2-level ExamType/ExamSubType system. Super Admin
// manages all three levels from the admin panel; nothing here is hardcoded
// beyond the initial seed data (see prisma/seed.ts) — new Authorities,
// Categories, and Sub-Categories can always be added later without any
// schema change.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class ExamTaxonomyService {
  /** Full tree — used by the admin Taxonomy Management page and by cascading dropdowns elsewhere. */
  async listFullTree() {
    return prisma.examAuthority.findMany({
      include: {
        categories: {
          include: {
            subCategories: { include: { _count: { select: { questions: true } } } },
            _count: { select: { questions: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createAuthority(name: string) {
    return prisma.examAuthority.create({ data: { name } });
  }

  async createCategory(authorityId: string, name: string) {
    return prisma.examCategory.create({ data: { authorityId, name } });
  }

  async createSubCategory(categoryId: string, name: string) {
    return prisma.examSubCategory.create({ data: { categoryId, name } });
  }

  /** For cascading dropdowns: categories under one authority. */
  async listCategories(authorityId: string) {
    return prisma.examCategory.findMany({ where: { authorityId }, orderBy: { name: 'asc' } });
  }

  /** For cascading dropdowns: sub-categories under one category. */
  async listSubCategories(categoryId: string) {
    return prisma.examSubCategory.findMany({ where: { categoryId }, orderBy: { name: 'asc' } });
  }
}
