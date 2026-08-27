// Practice Preference Service — implements the finalized Practice Setup
// structure:
//   Exam Type/Purpose → Exam Authority (multi) → Category → Sub-Category
//   → Difficulty → Practice Language (LAST, computed dynamically from what
//   the prior selections actually have published, never hardcoded).
//
// "All" at every level is a dynamic filter state, never a stored id — see
// resolveTaxonomyFilter. Purposes never mix: an "All" chosen inside one
// Purpose (e.g. Employment/Recruitment) can only ever expand to Authorities
// under THAT Purpose.

import { PrismaClient, Language, QuizMode, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface SelectionCategory {
  categoryId: string;
  allSubCategories: boolean;
  subCategoryIds: string[];
}

export interface SelectionAuthority {
  authorityId: string;
  allCategories: boolean;
  categories: SelectionCategory[];
}

export interface Selections {
  purposeId: string; // the single Exam Type/Purpose this preference is scoped to
  allAuthorities: boolean; // "All" WITHIN this purpose only — never crosses into another purpose
  authorities: SelectionAuthority[];
}

export class PracticePreferenceService {
  async get(userId: string) {
    return prisma.studentPracticePreference.findUnique({ where: { userId } });
  }

  async save(userId: string, language: Language, mode: QuizMode, selections: Selections) {
    return prisma.studentPracticePreference.upsert({
      where: { userId },
      create: { userId, language, mode, selections: selections as unknown as Prisma.InputJsonValue },
      update: { language, mode, selections: selections as unknown as Prisma.InputJsonValue },
    });
  }

  /**
   * Resolves a saved (or in-progress, not-yet-saved) selection into a Prisma
   * `where` fragment for Question queries. Always includes the Purpose scope
   * first — "All" only ever means "all Authorities under this Purpose".
   */
  resolveTaxonomyFilter(selections: Selections): Prisma.QuestionWhereInput {
    const purposeScope: Prisma.QuestionWhereInput = { authority: { purposeId: selections.purposeId } };

    if (selections.allAuthorities) {
      return purposeScope;
    }

    if (selections.authorities.length === 0) {
      return { id: 'never-matches' }; // shouldn't be reachable via the UI, but fail safe rather than "everything"
    }

    const orConditions: Prisma.QuestionWhereInput[] = [];
    for (const authority of selections.authorities) {
      if (authority.allCategories) {
        orConditions.push({ authorityId: authority.authorityId });
        continue;
      }
      for (const category of authority.categories) {
        if (category.allSubCategories || category.subCategoryIds.length === 0) {
          orConditions.push({ authorityId: authority.authorityId, categoryId: category.categoryId });
        } else {
          orConditions.push({
            authorityId: authority.authorityId,
            categoryId: category.categoryId,
            subCategoryId: { in: category.subCategoryIds },
          });
        }
      }
    }

    return { AND: [purposeScope, { OR: orConditions }] };
  }

  /**
   * The dynamic "which languages are actually available" check that drives
   * the LAST step of Setup. Never hardcodes "Tamil = TNPSC" or any such
   * rule — it's a live query against whatever is currently Published for
   * the student's exact selections (Purpose + Authorities/Categories/
   * Sub-Categories + Difficulty), so it stays correct as content grows.
   */
  async getAvailableLanguages(selections: Selections, mode: QuizMode): Promise<Language[]> {
    const taxonomyFilter = this.resolveTaxonomyFilter(selections);
    const difficulties = mode === 'MIXED' ? ['MEDIUM', 'HARD'] : [mode];

    const rows = await prisma.question.findMany({
      where: { status: 'PUBLISHED', difficulty: { in: difficulties as any }, ...taxonomyFilter },
      select: { language: true },
      distinct: ['language'],
    });

    return rows.map((r) => r.language);
  }
}
