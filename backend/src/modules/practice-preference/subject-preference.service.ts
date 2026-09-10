// Student Subject & Topic Preference — Stage 1 (finalized requirement).
// Purely storage + a student-facing picker: fetch the verified syllabus
// tree for one exam, and save/load the student's optional Subject/Topic
// preference for it. NOTHING here is read by allocation.service.ts or
// quota.service.ts yet — that's explicitly Stage 2, done separately once
// this stage is confirmed working. Existing strict rules (Exam, Subject,
// Language, Difficulty, No-Repeat) are completely untouched.

import { prisma } from '../../lib/prisma';
import { scopeAccessService } from '../quota/scope-access.service';

export class SubjectPreferenceError extends Error {}

export class SubjectPreferenceService {
  /** Every TNPSC exam currently visible to students (finalized
   * requirement — only officially-verified exams, same
   * studentVisible-filtered set Practice Setup itself uses) with at
   * least one Subject seeded, so the picker never shows an exam with
   * nothing to actually choose from. */
  async listAvailableExams() {
    return prisma.examSubCategory.findMany({
      where: {
        studentVisible: true,
        category: { authority: { name: 'TNPSC' } },
        syllabusSubjects: { some: {} },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /** The Subject -> Topic tree for one exam — same shape as the admin
   * syllabus service returns, just via a student-auth route instead of
   * an admin one. Only ever returns a studentVisible exam's data. */
  async getSyllabus(subCategoryId: string) {
    const subCategory = await prisma.examSubCategory.findUnique({
      where: { id: subCategoryId },
      select: { studentVisible: true },
    });
    if (!subCategory?.studentVisible) return [];

    return prisma.syllabusSubject.findMany({
      where: { subCategoryId },
      include: { topics: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getPreference(userId: string, subCategoryId: string) {
    return prisma.studentSubjectTopicPreference.findUnique({
      where: { userId_subCategoryId: { userId, subCategoryId } },
    });
  }

  /** Upsert — a student can revisit and change their preference anytime.
   * Both lists are OPTIONAL (finalized requirement — "Subject/Topic
   * Preference should be optional"); saving empty arrays is a valid,
   * explicit "no preference, give me normal full-syllabus coverage"
   * choice, not an error. */
  /** Sept 2026 — TNPSC Group IV & VAO Pass restriction (BINDING): Subject
   * Preference only makes sense across a full Authority's Categories, so a
   * student whose only active paid coverage is a restricted plan cannot
   * use it at all, even by calling this endpoint directly. */
  async savePreference(userId: string, subCategoryId: string, subjectIds: string[], topicIds: string[]) {
    if (await scopeAccessService.isRestrictedOnly(userId)) {
      throw new SubjectPreferenceError('Subject Preference is not available on the TNPSC Group IV & VAO Pass. Upgrade to the TNPSC Annual Pass to use it.');
    }
    return prisma.studentSubjectTopicPreference.upsert({
      where: { userId_subCategoryId: { userId, subCategoryId } },
      create: { userId, subCategoryId, subjectIds, topicIds },
      update: { subjectIds, topicIds },
    });
  }

  async clearPreference(userId: string, subCategoryId: string) {
    await prisma.studentSubjectTopicPreference.deleteMany({ where: { userId, subCategoryId } });
  }
}
