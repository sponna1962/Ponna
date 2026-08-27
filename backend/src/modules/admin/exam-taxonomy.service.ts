// Exam Taxonomy Service — implements the 4-level dynamic classification:
//   Exam Type/Purpose → Authority / Exam Area → Category → Sub-Category (optional)
// Purposes group unrelated exam families apart from each other (Employment/
// Recruitment vs Higher Education/Admission vs Eligibility/Qualification) —
// an "All" selected inside one Purpose never pulls in Authorities from
// another. Super Admin manages all four levels from the admin panel; nothing
// here is hardcoded beyond the initial seed data (see prisma/seed.ts) — new
// Purposes, Authorities, Categories, and Sub-Categories can always be added
// later without any schema change.

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class ExamTaxonomyService {
  /** Full tree (Purpose → Authority → Category → Sub-Category) — used by the
   * admin Taxonomy Management page and by the student Practice Setup flow. */
  async listFullTree() {
    return prisma.examPurpose.findMany({
      include: {
        authorities: {
          include: {
            categories: {
              include: {
                subCategories: { include: { _count: { select: { questions: true } } } },
                _count: { select: { questions: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createPurpose(name: string, nameTa?: string) {
    return prisma.examPurpose.create({ data: { name, nameTa } });
  }

  async createAuthority(purposeId: string, name: string) {
    return prisma.examAuthority.create({ data: { purposeId, name } });
  }

  async createCategory(authorityId: string, name: string) {
    return prisma.examCategory.create({ data: { authorityId, name } });
  }

  async createSubCategory(categoryId: string, name: string) {
    return prisma.examSubCategory.create({ data: { categoryId, name } });
  }

  /** For cascading dropdowns: authorities under one purpose. */
  async listAuthorities(purposeId: string) {
    return prisma.examAuthority.findMany({ where: { purposeId }, orderBy: { name: 'asc' } });
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
