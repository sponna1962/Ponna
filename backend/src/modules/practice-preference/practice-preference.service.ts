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

/** Thrown by validateSelections for any rule violation — server.ts maps this
 * to HTTP 400, distinct from unexpected/server errors (500). */
export class InvalidSelectionError extends Error {}

export class PracticePreferenceService {
  async get(userId: string) {
    return prisma.studentPracticePreference.findUnique({ where: { userId } });
  }

  /**
   * The single, shared source of truth for "is this Authority combination
   * legal" — called from the PUT save route (rejects a bad request outright,
   * even if the frontend UI was bypassed entirely) and reused by nothing
   * else duplicating this logic. Never hardcodes an exam name: driven
   * entirely by Purpose.allowMultipleAuthorities and Authority.selectionGroup,
   * both DB-editable from the admin panel.
   *
   * Rules (finalized requirement):
   *  - allAuthorities is only legal when the Purpose allows it.
   *  - A Purpose with allowMultipleAuthorities = true (Competitive/Employment)
   *    permits any combination of its Authorities — unchanged.
   *  - A Purpose with allowMultipleAuthorities = false (Higher Education/
   *    Entrance, Eligibility/Qualification) permits more than one Authority
   *    ONLY when every selected Authority shares the same non-null
   *    selectionGroup (e.g. JEE Main + JEE Advanced, both "JEE"). A
   *    standalone Authority (selectionGroup = null) can never be combined
   *    with anything, and two different non-null groups can never combine.
   */
  async validateSelections(selections: Selections): Promise<void> {
    const purpose = await prisma.examPurpose.findUnique({
      where: { id: selections.purposeId },
      include: { authorities: true },
    });
    if (!purpose) {
      throw new InvalidSelectionError('Unknown purpose');
    }

    if (selections.allAuthorities) {
      if (!purpose.allowMultipleAuthorities) {
        throw new InvalidSelectionError('"All authorities" is not allowed for this purpose');
      }
      return;
    }

    if (purpose.allowMultipleAuthorities) {
      // Any combination of this purpose's own Authorities is fine — just
      // confirm each selected id actually belongs to this purpose.
      for (const sel of selections.authorities) {
        if (!purpose.authorities.some((a) => a.id === sel.authorityId)) {
          throw new InvalidSelectionError('Selected authority does not belong to this purpose');
        }
      }
      return;
    }

    // Single-select purpose: 0 or 1 authority is trivially fine. More than
    // one is only legal when every selected authority shares the same
    // non-null selectionGroup.
    if (selections.authorities.length <= 1) {
      if (selections.authorities[0] && !purpose.authorities.some((a) => a.id === selections.authorities[0].authorityId)) {
        throw new InvalidSelectionError('Selected authority does not belong to this purpose');
      }
      return;
    }

    const selectedAuthorities = selections.authorities.map((sel) => {
      const authority = purpose.authorities.find((a) => a.id === sel.authorityId);
      if (!authority) {
        throw new InvalidSelectionError('Selected authority does not belong to this purpose');
      }
      return authority;
    });

    const groups = new Set(selectedAuthorities.map((a) => a.selectionGroup));
    if (groups.has(null) || groups.size > 1) {
      throw new InvalidSelectionError(
        'These authorities cannot be combined — only authorities in the same selection group may be selected together',
      );
    }
  }

  async save(userId: string, language: Language, mode: QuizMode, selections: Selections) {
    await this.validateSelections(selections);
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
   *
   * Also matches questions TAGGED to a selected Authority/Category/Sub-
   * Category (Original/Book/Other questions that genuinely apply to
   * several exams/groups at once — finalized requirement — e.g. one TNPSC
   * General Studies question tagged once per Group: Group I, Group II,
   * Group III...), not just questions whose PRIMARY classification matches
   * directly. Tag matching mirrors the exact same superset semantics as
   * the primary fields: a tag with only an Authority matches "All
   * Categories" selections for it; one with a Category (no Sub-Category)
   * matches any Sub-Category selection under that Category.
   */
  resolveTaxonomyFilter(selections: Selections): Prisma.QuestionWhereInput {
    if (selections.allAuthorities) {
      return {
        OR: [
          { authority: { purposeId: selections.purposeId } },
          { authorityTags: { some: { authority: { purposeId: selections.purposeId } } } },
        ],
      };
    }

    if (selections.authorities.length === 0) {
      return { id: 'never-matches' }; // shouldn't be reachable via the UI, but fail safe rather than "everything"
    }

    const orConditions: Prisma.QuestionWhereInput[] = [];
    for (const authority of selections.authorities) {
      if (authority.allCategories) {
        orConditions.push({
          OR: [{ authorityId: authority.authorityId }, { authorityTags: { some: { authorityId: authority.authorityId } } }],
        });
        continue;
      }
      for (const category of authority.categories) {
        if (category.allSubCategories || category.subCategoryIds.length === 0) {
          orConditions.push({
            OR: [
              { authorityId: authority.authorityId, categoryId: category.categoryId },
              { authorityTags: { some: { authorityId: authority.authorityId, categoryId: category.categoryId } } },
            ],
          });
        } else {
          orConditions.push({
            OR: [
              { authorityId: authority.authorityId, categoryId: category.categoryId, subCategoryId: { in: category.subCategoryIds } },
              {
                authorityTags: {
                  some: { authorityId: authority.authorityId, categoryId: category.categoryId, subCategoryId: { in: category.subCategoryIds } },
                },
              },
            ],
          });
        }
      }
    }

    return { OR: orConditions };
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
