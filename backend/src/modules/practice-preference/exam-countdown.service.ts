// Exam Countdown (Sept 2026, Priority — Personalization). Reads the
// student's saved Practice Preference to find which Sub-Category(ies)
// they're preparing for, then looks up the admin-set, structured
// ExamSubCategory.examDate for those — never parses VerifiedExamFact's
// free-text EXAM_DATE value (unreliable for a numeric "N days" figure).
// Read-only; admin sets the actual date via
// PATCH /admin/exam-taxonomy/sub-categories/:id/exam-date.

import { prisma } from '../../lib/prisma';

export interface ExamCountdown {
  subCategoryId: string;
  subCategoryName: string;
  examDate: Date;
  daysRemaining: number;
}

function extractSubCategoryIds(selections: any): string[] {
  const ids: string[] = [];
  for (const auth of selections?.authorities ?? []) {
    for (const cat of auth?.categories ?? []) {
      for (const id of cat?.subCategoryIds ?? []) {
        if (id) ids.push(id);
      }
    }
  }
  return ids;
}

export class ExamCountdownService {
  /** The single nearest upcoming exam date among the student's currently
   * selected Sub-Category(ies) — null if they have no saved preference,
   * their selection uses an "All" wildcard (no concrete ids to look up),
   * or none of their selected exams has a date set yet. */
  async getCountdown(userId: string): Promise<ExamCountdown | null> {
    const preference = await prisma.studentPracticePreference.findUnique({ where: { userId } });
    if (!preference) return null;

    const subCategoryIds = extractSubCategoryIds(preference.selections);
    if (subCategoryIds.length === 0) return null;

    const subCategories = await prisma.examSubCategory.findMany({
      where: { id: { in: subCategoryIds }, examDate: { not: null } },
      select: { id: true, name: true, examDate: true },
    });

    const now = new Date();
    const upcoming = subCategories
      .filter((s) => s.examDate && s.examDate > now)
      .sort((a, b) => a.examDate!.getTime() - b.examDate!.getTime());

    if (upcoming.length === 0) return null;

    const nearest = upcoming[0];
    const daysRemaining = Math.ceil((nearest.examDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      subCategoryId: nearest.id,
      subCategoryName: nearest.name,
      examDate: nearest.examDate!,
      daysRemaining,
    };
  }
}

export const examCountdownService = new ExamCountdownService();
