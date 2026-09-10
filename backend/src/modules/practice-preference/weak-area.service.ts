// Weak-Area Alert (Sept 2026) — surfaces the student's single weakest
// Subject, scoped to their current Practice Preference's Sub-Category, so
// it's guaranteed relevant to the exam they're actually preparing for
// (never a mismatched Subject from a different exam). Read-only —
// computed entirely from UserQuestionHistory + Question.subjectId, no
// new tracking table.
//
// Careful-by-design, especially for a first-time/rural student who has
// no coaching to interpret a noisy number for them:
// - MIN_SAMPLE_SIZE per Subject before it's even considered — a couple
//   of unlucky answers should never label a Subject "weak".
// - Only flagged when meaningfully weak RELATIVE to the student's own
//   overall accuracy in that scope (WEAKNESS_GAP_THRESHOLD points below),
//   not against some fixed absolute cutoff — a 60% student and an 85%
//   student have different "weak" baselines.
// - Exactly one Subject, the weakest — never a list, to keep the
//   suggestion simple and actionable.
// - Restricted-only students (e.g. the TNPSC Group 4 - VAO Pass) can't
//   use Subject Preference at all — this returns null for them rather
//   than surfacing an alert whose "Practice Now" action would fail.

import { prisma } from '../../lib/prisma';
import { scopeAccessService } from '../quota/scope-access.service';

const MIN_SAMPLE_SIZE = 10;
const WEAKNESS_GAP_THRESHOLD = 15; // percentage points below the student's own overall accuracy in this scope

export interface WeakAreaAlert {
  subCategoryId: string;
  subjectId: string;
  subjectName: string;
  accuracy: number; // 0-100, rounded
  overallAccuracy: number; // 0-100, rounded — same scope, for comparison
  sampleSize: number;
}

function extractFirstSubCategoryId(selections: any): string | null {
  for (const auth of selections?.authorities ?? []) {
    for (const cat of auth?.categories ?? []) {
      for (const id of cat?.subCategoryIds ?? []) {
        if (id) return id;
      }
    }
  }
  return null;
}

export class WeakAreaService {
  async getWeakArea(userId: string): Promise<WeakAreaAlert | null> {
    if (await scopeAccessService.isRestrictedOnly(userId)) return null;

    const preference = await prisma.studentPracticePreference.findUnique({ where: { userId } });
    if (!preference) return null;

    const subCategoryId = extractFirstSubCategoryId(preference.selections);
    if (!subCategoryId) return null;

    const rows = await prisma.userQuestionHistory.findMany({
      where: { userId, question: { subCategoryId } },
      select: { answeredCorrectly: true, question: { select: { subjectId: true } } },
    });
    if (rows.length < MIN_SAMPLE_SIZE) return null;

    const overallCorrect = rows.filter((r) => r.answeredCorrectly).length;
    const overallAccuracy = (overallCorrect / rows.length) * 100;

    const bySubject = new Map<string, { correct: number; total: number }>();
    for (const r of rows) {
      const subjectId = r.question.subjectId;
      if (!subjectId) continue;
      const cur = bySubject.get(subjectId) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (r.answeredCorrectly) cur.correct += 1;
      bySubject.set(subjectId, cur);
    }

    let weakest: { subjectId: string; accuracy: number; total: number } | null = null;
    for (const [subjectId, { correct, total }] of bySubject) {
      if (total < MIN_SAMPLE_SIZE) continue;
      const accuracy = (correct / total) * 100;
      if (overallAccuracy - accuracy >= WEAKNESS_GAP_THRESHOLD) {
        if (!weakest || accuracy < weakest.accuracy) weakest = { subjectId, accuracy, total };
      }
    }
    if (!weakest) return null;

    const subject = await prisma.subject.findUnique({ where: { id: weakest.subjectId } });
    if (!subject) return null;

    return {
      subCategoryId,
      subjectId: weakest.subjectId,
      subjectName: subject.name,
      accuracy: Math.round(weakest.accuracy),
      overallAccuracy: Math.round(overallAccuracy),
      sampleSize: weakest.total,
    };
  }
}

export const weakAreaService = new WeakAreaService();
