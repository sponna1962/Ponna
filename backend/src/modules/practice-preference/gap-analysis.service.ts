// Smart Gap Analysis (Sept 2026) — PONNA's differentiated alternative to
// a generic "estimated score" gauge. Rather than a made-up projection,
// this shows a student EXACTLY how much of their exam's REAL, verified
// syllabus (from Syllabus PDF Import -- an official TNPSC document, not
// a guess) they've actually started practicing, and names the specific
// remaining Subjects by their real syllabus names. Competitors can't
// replicate this without the same verified-syllabus foundation.
//
// Coverage granularity note: this works at the SYLLABUS SUBJECT level
// (e.g. "Indian Polity"), not the finer Topic level, because that's the
// granularity real data actually supports today -- content team fills
// in the flat Subject field on every question (confirmed this session),
// but does NOT tag questions to specific SyllabusTopic rows. Matching
// SyllabusSubject names to flat Subject names (case-insensitive,
// either-contains-the-other) is therefore the honest, working metric;
// claiming Topic-level coverage would imply data precision that doesn't
// exist yet. If per-question Topic tagging is adopted later, this can
// be refined without changing the student-facing shape.

import { prisma } from '../../lib/prisma';
import { extractFirstSubCategoryId } from './weak-area.service';

export interface GapAnalysisResult {
  subCategoryName: string;
  totalSubjects: number;
  coveredSubjects: number;
  coveragePercent: number;
  covered: { name: string; nameTa: string | null; questionsAttempted: number }[];
  remaining: { name: string; nameTa: string | null }[];
}

// A subject counts as "started" once the student has attempted at least
// this many distinct questions in it -- a single lucky/unlucky question
// isn't a meaningful signal either way.
const MIN_QUESTIONS_TO_COUNT_AS_STARTED = 3;

export class GapAnalysisService {
  private normalize(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9\u0b80-\u0bff]/g, '');
  }

  /** True if either name's normalized form contains the other's -- a
   * deliberately loose match (e.g. "General Tamil / General English"
   * syllabus subject vs a flat "General Tamil" Subject row), since exact
   * string equality would miss real matches content teams phrase
   * slightly differently across the two places these names live. */
  private namesMatch(a: string, b: string): boolean {
    const na = this.normalize(a);
    const nb = this.normalize(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
  }

  async getGapAnalysis(userId: string): Promise<GapAnalysisResult | null> {
    const preference = await prisma.studentPracticePreference.findUnique({ where: { userId } });
    if (!preference) return null;
    const subCategoryId = extractFirstSubCategoryId(preference.selections);
    if (!subCategoryId) return null;

    const subCategory = await prisma.examSubCategory.findUniqueOrThrow({
      where: { id: subCategoryId },
      include: { syllabusSubjects: { orderBy: { sortOrder: 'asc' } } },
    });

    // No imported syllabus data for this exam yet (Syllabus PDF Import
    // not done for it) -- nothing honest to show, so this feature simply
    // doesn't appear rather than displaying a meaningless 0/0.
    if (subCategory.syllabusSubjects.length === 0) return null;

    const allSubjects = await prisma.subject.findMany();

    const covered: GapAnalysisResult['covered'] = [];
    const remaining: GapAnalysisResult['remaining'] = [];

    for (const syllabusSubject of subCategory.syllabusSubjects) {
      const matchingSubjectIds = allSubjects.filter((s) => this.namesMatch(s.name, syllabusSubject.name)).map((s) => s.id);

      let questionsAttempted = 0;
      if (matchingSubjectIds.length > 0) {
        questionsAttempted = await prisma.userQuestionHistory.count({
          where: { userId, question: { subjectId: { in: matchingSubjectIds } } },
        });
      }

      if (questionsAttempted >= MIN_QUESTIONS_TO_COUNT_AS_STARTED) {
        covered.push({ name: syllabusSubject.name, nameTa: syllabusSubject.nameTa, questionsAttempted });
      } else {
        remaining.push({ name: syllabusSubject.name, nameTa: syllabusSubject.nameTa });
      }
    }

    const totalSubjects = subCategory.syllabusSubjects.length;
    const coveredSubjects = covered.length;

    return {
      subCategoryName: subCategory.name,
      totalSubjects,
      coveredSubjects,
      coveragePercent: totalSubjects > 0 ? Math.round((coveredSubjects / totalSubjects) * 100) : 0,
      covered,
      remaining,
    };
  }
}

export const gapAnalysisService = new GapAnalysisService();
