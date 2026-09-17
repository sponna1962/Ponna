// Student Subject & Topic Preference — Stage 2 (strict allocation boundary).
// Fetches the verified syllabus tree for one exam and stores the student's
// optional Subject/Topic preference. When a preference changes, any existing
// in-progress session is invalidated so the next Start Practice request cannot
// resume a session created under a different Subject/Topic selection.

import { prisma } from '../../lib/prisma';
import { scopeAccessService } from '../quota/scope-access.service';

export class SubjectPreferenceError extends Error {}

export class SubjectPreferenceService {
  /** Every TNPSC exam currently visible to students with at least one
   * verified Subject seeded. */
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

  /** The Subject -> Topic tree for one exam. */
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

  /**
   * Saves the optional Subject/Topic preference.
   *
   * Critical session-consistency rule: changing Subject/Topic Preference
   * changes the question-allocation contract. An existing IN_PROGRESS quiz
   * must therefore never be resumed under the new preference. We invalidate
   * it here; the next Start Practice call creates a fresh session and the
   * strict allocator receives the newly saved preference.
   *
   * We only invalidate when the actual preference changed, so clicking Done
   * without changing anything does not disturb a valid in-progress session.
   */
  async savePreference(userId: string, subCategoryId: string, subjectIds: string[], topicIds: string[]) {
    if (await scopeAccessService.isRestrictedOnly(userId)) {
      throw new SubjectPreferenceError('Subject Preference is not available on the TNPSC Group - IV Pass. Upgrade to the TNPSC Annual Pass to use it.');
    }

    const normalizedSubjectIds = [...new Set(subjectIds)].sort();
    const normalizedTopicIds = [...new Set(topicIds)].sort();
    const existingPreference = await prisma.studentSubjectTopicPreference.findUnique({
      where: { userId_subCategoryId: { userId, subCategoryId } },
      select: { subjectIds: true, topicIds: true },
    });

    const samePreference =
      JSON.stringify([...(existingPreference?.subjectIds ?? [])].sort()) === JSON.stringify(normalizedSubjectIds) &&
      JSON.stringify([...(existingPreference?.topicIds ?? [])].sort()) === JSON.stringify(normalizedTopicIds);

    const saved = await prisma.studentSubjectTopicPreference.upsert({
      where: { userId_subCategoryId: { userId, subCategoryId } },
      create: { userId, subCategoryId, subjectIds: normalizedSubjectIds, topicIds: normalizedTopicIds },
      update: { subjectIds: normalizedSubjectIds, topicIds: normalizedTopicIds },
    });

    if (!samePreference) {
      await prisma.quizSession.updateMany({
        where: { userId, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED' },
      });
    }

    return saved;
  }

  async clearPreference(userId: string, subCategoryId: string) {
    const deleted = await prisma.studentSubjectTopicPreference.deleteMany({ where: { userId, subCategoryId } });
    if (deleted.count > 0) {
      await prisma.quizSession.updateMany({
        where: { userId, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED' },
      });
    }
  }
}
