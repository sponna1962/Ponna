// Exam Taxonomy Service — implements the 4-level dynamic classification:
//   Exam Type/Purpose → Authority / Exam Area → Category → Sub-Category (optional)
// Purposes group unrelated exam families apart from each other (Employment/
// Recruitment vs Higher Education/Admission vs Eligibility/Qualification) —
// an "All" selected inside one Purpose never pulls in Authorities from
// another. Super Admin manages all four levels from the admin panel; nothing
// here is hardcoded beyond the initial seed data (see prisma/seed.ts) — new
// Purposes, Authorities, Categories, and Sub-Categories can always be added
// later without any schema change.

import { prisma } from '../../lib/prisma';

export class ExamTaxonomyService {
  /** Full tree (Purpose → Authority → Category → Sub-Category) — admin-only,
   * used by the admin Taxonomy Management page and every other admin
   * screen that needs the complete structure regardless of student-facing
   * visibility (Bulk Upload, Add Question, Bulk Edit Metadata tag pickers,
   * etc.). Never filters by studentVisible — see listStudentVisibleTree()
   * for the version the student-facing routes use. */
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

  /** Same tree, but only what's currently student-facing-visible — used by
   * the STUDENT Practice Setup route only (GET /exam-taxonomy). A hidden
   * Purpose (studentVisible: false) drops the whole Purpose and everything
   * under it; a hidden Authority drops just that one Authority, even
   * inside an otherwise-visible Purpose (finalized requirement, Sept 15
   * launch). Never touches the underlying data — an admin can always see
   * and manage everything via listFullTree() above regardless of this. */
  async listStudentVisibleTree() {
    return prisma.examPurpose.findMany({
      where: { studentVisible: true },
      include: {
        authorities: {
          where: { studentVisible: true },
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

  /** Super Admin toggle for whether this Purpose allows multiple Authorities
   * in one saved Preference, plus studentVisible — hides/shows this whole
   * Purpose from the student-facing taxonomy (Sept 15 launch requirement),
   * without affecting the admin panel or any underlying data. */
  async setPurposeConfig(purposeId: string, config: { allowMultipleAuthorities?: boolean; studentVisible?: boolean }) {
    return prisma.examPurpose.update({ where: { id: purposeId }, data: config });
  }

  async createAuthority(purposeId: string, name: string, selectionGroup?: string | null) {
    return prisma.examAuthority.create({ data: { purposeId, name, selectionGroup: selectionGroup || null } });
  }

  /** Super Admin toggles for the Authority-level UI configuration flags, plus
   * selectionGroup — the config-driven exception that lets specific
   * Authorities within an otherwise single-select Purpose be combined (e.g.
   * JEE Main + JEE Advanced sharing selectionGroup "JEE"). Empty string from
   * the admin form is normalized to null (standalone). studentVisible
   * hides/shows just this one Authority from the student-facing taxonomy
   * (Sept 15 launch requirement), even when its Purpose stays visible. */
  async setAuthorityConfig(
    authorityId: string,
    config: { allowAllCategories?: boolean; difficultyEnabled?: boolean; selectionGroup?: string | null; studentVisible?: boolean },
  ) {
    const data = { ...config };
    if ('selectionGroup' in data) {
      data.selectionGroup = data.selectionGroup?.trim() || null;
    }
    return prisma.examAuthority.update({ where: { id: authorityId }, data });
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
