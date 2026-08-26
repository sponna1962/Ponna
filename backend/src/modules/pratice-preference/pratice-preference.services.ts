// Practice Preference Service — implements the finalized Practice Setup
// requirement: a student sets Language + Exam Authority/Category/
// Sub-Category (all multi-select) + Difficulty ONCE, it's saved, and every
// future practice session reuses it until they explicitly "Change
// Preferences". See schema.prisma's StudentPracticePreference doc-comment
// for the JSON shape and why "All" is a boolean flag rather than a stored id.

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
  allAuthorities: boolean;
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
   * Resolves a saved preference into a Prisma `where` fragment for Question
   * queries — this is where "All" is expanded dynamically, always against
   * the CURRENT taxonomy (never a snapshot), so newly-added Authorities/
   * Categories/Sub-Categories automatically flow into an "All"-based
   * preference with zero action from the student.
   *
   * Returns just the authority/category/subCategory portion — callers
   * combine this with their own status/difficulty/language conditions
   * (language is deliberately NOT decided here — see the finalized rule
   * that Language is a pure content filter, independent of Authority).
   */
  async resolveTaxonomyFilter(selections: Selections): Promise<Prisma.QuestionWhereInput> {
    if (selections.allAuthorities) {
      return {}; // no restriction at all — any Authority/Category/Sub-Category
    }

    if (selections.authorities.length === 0) {
      // Nothing selected and not "All" — deliberately matches nothing,
      // rather than silently falling back to "everything" (a preference in
      // this state shouldn't be possible via the UI, but fail safe).
      return { id: 'never-matches' };
    }

    const orConditions: Prisma.QuestionWhereInput[] = [];

    for (const authority of selections.authorities) {
      if (authority.allCategories) {
        orConditions.push({ authorityId: authority.authorityId });
        continue;
      }
      for (const category of authority.categories) {
        if (category.allSubCategories || category.subCategoryIds.length === 0) {
          orConditions.push({ categoryId: category.categoryId });
        } else {
          orConditions.push({ categoryId: category.categoryId, subCategoryId: { in: category.subCategoryIds } });
        }
      }
    }

    return { OR: orConditions };
  }
}
