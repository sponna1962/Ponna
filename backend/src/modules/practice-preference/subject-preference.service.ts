// Student Subject & Topic Preference — Stage 2 (strict allocation boundary).
// Fetches the verified syllabus tree for one exam and stores the student's
// optional Subject/Topic preference. When a preference changes during an
// active 75-question session, answered questions stay exactly where they
// are and only the unanswered tail is reallocated from the new preference.

import { prisma } from '../../lib/prisma';
import { scopeAccessService } from '../quota/scope-access.service';
import { AllocationService } from '../questions/allocation.service';
import { PracticePreferenceService } from './practice-preference.service';

export class SubjectPreferenceError extends Error {}

const allocation = new AllocationService();
const practicePreferenceService = new PracticePreferenceService();

function generateOptionOrder(): string {
  const letters = ['A', 'B', 'C', 'D'];
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
}

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
   * Active-session rule: changing Subject/Topic Preference MUST NOT throw
   * away the student's progress. If a student has answered 50/75 and then
   * changes the Subject Preference, questions 1-50 remain untouched and
   * questions 51-75 are replaced with questions from the newly selected
   * Subject/Topic. The session remains 75 questions and the next question
   * is still numbered 51.
   *
   * Quota is not reserved again: the session already reserved its 75
   * questions when it was created, and this operation only swaps the
   * unanswered tail.
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
      await this.reallocateUnansweredTail(userId, subCategoryId, normalizedSubjectIds, normalizedTopicIds);
    }

    return saved;
  }

  /**
   * Rebuild only the unanswered part of the student's active session.
   * Answered rows are never deleted or renumbered.
   */
  private async reallocateUnansweredTail(
    userId: string,
    subCategoryId: string,
    subjectIds: string[],
    topicIds: string[],
  ) {
    const session = await prisma.quizSession.findFirst({
      where: { userId, status: 'IN_PROGRESS' },
      include: {
        questions: {
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });

    if (!session || session.questions.length === 0) return;

    const answeredCount = session.questions.filter((q) => q.answered).length;
    const remainingCount = Math.max(0, session.totalQuestions - answeredCount);
    if (remainingCount === 0) return;

    const practicePreference = await practicePreferenceService.get(userId);
    if (!practicePreference || practicePreference.language !== session.practiceLanguage) return;

    const taxonomyFilter = practicePreferenceService.resolveTaxonomyFilter(practicePreference.selections as any);
    const currentSubCategoryId = practicePreferenceService.extractSingleSubCategoryId(practicePreference.selections as any);

    // The Subject Preference belongs to this exact exam. If the student's
    // current Practice Setup is no longer pointing at that exam, leave the
    // active session untouched rather than mixing exam scopes.
    if (currentSubCategoryId !== subCategoryId) return;

    const questionIds = await allocation.buildSessionQuestionIds(
      userId,
      session.mode,
      remainingCount,
      session.practiceLanguage,
      taxonomyFilter,
      { subjectIds, topicIds },
    );

    // If the new preference has fewer eligible questions than the remaining
    // tail, keep the answered portion intact and shrink the session to the
    // number of questions that can actually be delivered. Under normal data
    // conditions this will still be the original 75.
    const targetTotal = answeredCount + questionIds.length;
    if (questionIds.length === 0) {
      throw new SubjectPreferenceError('No unanswered questions are available for the selected Subject/Topic right now.');
    }

    await prisma.$transaction([
      prisma.quizSessionQuestion.deleteMany({
        where: { sessionId: session.id, answered: false },
      }),
      prisma.quizSession.update({
        where: { id: session.id },
        data: { totalQuestions: targetTotal, lastActivityAt: new Date() },
      }),
      prisma.quizSessionQuestion.createMany({
        data: questionIds.map((questionId, index) => ({
          sessionId: session.id,
          questionId,
          sequenceNumber: answeredCount + index + 1,
          optionOrder: generateOptionOrder(),
        })),
      }),
    ]);
  }

  async clearPreference(userId: string, subCategoryId: string) {
    const deleted = await prisma.studentSubjectTopicPreference.deleteMany({ where: { userId, subCategoryId } });
    if (deleted.count > 0) {
      await this.reallocateUnansweredTail(userId, subCategoryId, [], []);
    }
  }
}
