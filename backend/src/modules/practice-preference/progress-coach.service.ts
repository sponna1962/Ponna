// Verified Progress Coach (Sept 2026) — PONNA's differentiated
// alternative to a generic personified "coach character". Rather than
// scripted encouragement, this composes ONE honest, actionable insight
// per student by combining two things that are ALREADY verified:
//   1. Weak-Area Alert (weak-area.service.ts) -- a real, sample-checked
//      accuracy gap for one Subject.
//   2. This exam's own PAPER_STRUCTURE VerifiedExamFact(s) (from Exam
//      Data Import, sourced from the official Scheme of Examination) --
//      searched for a genuine textual mention of the weak Subject's
//      name, so any "this affects your X-mark paper" context is a real
//      match, never an invented per-subject percentage.
//
// Deliberately does NOT claim a precise "this subject is worth N% of
// your marks" -- Group IV's real Scheme of Examination gives marks per
// PAPER (e.g. "General Studies paper: 75 Questions, 150 Marks"), not
// per syllabus Subject within that paper (e.g. "Indian Polity" has no
// separately verified weightage). Claiming that precision would be a
// fabrication this whole session has been built around avoiding.

import { prisma } from '../../lib/prisma';
import { weakAreaService } from './weak-area.service';

export interface ProgressCoachInsight {
  subjectName: string;
  accuracy: number;
  overallAccuracy: number;
  subCategoryId: string;
  subjectId: string;
  // Present only if a PAPER_STRUCTURE fact's own text genuinely mentions
  // this subject name -- null means no verified match was found, and
  // the frontend should show the weak-area point on its own rather than
  // inventing a paper-weightage claim.
  relatedPaperFact: { value: string; sourceUrl: string | null } | null;
}

export class ProgressCoachService {
  async getInsight(userId: string): Promise<ProgressCoachInsight | null> {
    const weakArea = await weakAreaService.getWeakArea(userId);
    if (!weakArea) return null;

    const paperFacts = await prisma.verifiedExamFact.findMany({
      where: { subCategoryId: weakArea.subCategoryId, factType: 'PAPER_STRUCTURE' },
      select: { value: true, sourceUrl: true },
    });

    const normalizedSubject = weakArea.subjectName.toLowerCase();
    const matchingFact = paperFacts.find((f) => f.value.toLowerCase().includes(normalizedSubject)) ?? null;

    return {
      subjectName: weakArea.subjectName,
      accuracy: weakArea.accuracy,
      overallAccuracy: weakArea.overallAccuracy,
      subCategoryId: weakArea.subCategoryId,
      subjectId: weakArea.subjectId,
      relatedPaperFact: matchingFact,
    };
  }
}

export const progressCoachService = new ProgressCoachService();
