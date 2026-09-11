// TEMPORARY diagnostic — Sept 2026, real-DB validation of the
// submitAnswer duplicate-submission idempotency fix (commit 5661d53).
// Runs the real Start Practice -> Submit -> Duplicate Submit flow
// against the actual production database, using ONLY a designated Test
// Account (isTestAccount=true) so no real student's data is ever
// touched. Reuses the existing SessionService as-is (no changes to
// session.service.ts or any other production logic) — this file only
// takes before/after snapshots around two real submitAnswer calls and
// reports whether anything changed between them.
//
// Safe to remove once the validation is confirmed — this is a one-time
// verification tool, not a permanent feature.

import { prisma } from '../../lib/prisma';
import { SessionService } from '../quiz/session.service';
import { Difficulty } from '@prisma/client';

const sessionService = new SessionService();

async function snapshot(userId: string, questionId: string, difficulty: Difficulty | null) {
  const [overall, bucket, historyRows, mistakeCount, user, milestoneCount] = await Promise.all([
    prisma.userPerformanceSummary.findUnique({ where: { userId_bucket: { userId, bucket: 'OVERALL' } } }),
    difficulty ? prisma.userPerformanceSummary.findUnique({ where: { userId_bucket: { userId, bucket: difficulty } } }) : null,
    prisma.userQuestionHistory.findMany({ where: { userId, questionId } }),
    prisma.mistakeReview.count({ where: { userId, questionId } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { currentStreak: true, longestStreak: true, lastStreakDate: true } }),
    prisma.studentMilestone.count({ where: { userId } }),
  ]);

  return {
    performanceOverall: overall ? { questionsAnswered: overall.questionsAnswered, correctAnswers: overall.correctAnswers } : null,
    performanceBucket: bucket ? { questionsAnswered: bucket.questionsAnswered, correctAnswers: bucket.correctAnswers } : null,
    historyRowCount: historyRows.length, // must stay 1 (upsert, never a second row)
    mistakeRecordCount: mistakeCount,
    streak: { currentStreak: user.currentStreak, longestStreak: user.longestStreak, lastStreakDate: user.lastStreakDate },
    milestoneCount,
  };
}

export async function runIdempotencyDiagnostic(identifier: { testUserId?: string; testPhone?: string }) {
  if (!identifier.testUserId && !identifier.testPhone) {
    throw new Error('Provide either testUserId or testPhone.');
  }
  const user = identifier.testUserId
    ? await prisma.user.findUniqueOrThrow({ where: { id: identifier.testUserId } })
    : await prisma.user.findFirstOrThrow({ where: { phone: identifier.testPhone } });
  const testUserId = user.id;

  if (!user.isTestAccount) {
    throw new Error('Refusing to run: this diagnostic only runs against a Test Account (isTestAccount=true), to guarantee no real student data is touched.');
  }

  const session = await sessionService.startSession(testUserId);
  const unanswered = (session as any).questions?.find((q: any) => !q.answered);
  if (!unanswered) {
    throw new Error('No unanswered question available in this Test Account\'s session — check its Practice Preference / quota, or that it has unseen questions left.');
  }
  const questionId: string = unanswered.questionId;
  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  const selectedOption = question.correctOption; // deterministic: always the correct option, so isCorrect=true and we ALSO exercise the "correct answer" path cleanly

  const before = await snapshot(testUserId, questionId, question.difficulty);
  const firstResult = await sessionService.submitAnswer(session.id, questionId, selectedOption);
  const afterFirst = await snapshot(testUserId, questionId, question.difficulty);
  const duplicateResult = await sessionService.submitAnswer(session.id, questionId, selectedOption);
  const afterDuplicate = await snapshot(testUserId, questionId, question.difficulty);

  // Clean up — never leave a lingering IN_PROGRESS session behind for this
  // Test Account (no quota refund needed, this is a Test Account).
  await prisma.quizSession.update({ where: { id: session.id }, data: { status: 'ABANDONED' } });

  const checks = {
    duplicateReturnsOriginalResult: JSON.stringify(firstResult) === JSON.stringify(duplicateResult),
    performanceOverallNotDoubleCounted: JSON.stringify(afterFirst.performanceOverall) === JSON.stringify(afterDuplicate.performanceOverall),
    performanceBucketNotDoubleCounted: JSON.stringify(afterFirst.performanceBucket) === JSON.stringify(afterDuplicate.performanceBucket),
    historyNotDuplicated: afterFirst.historyRowCount === afterDuplicate.historyRowCount && afterDuplicate.historyRowCount === 1,
    mistakeRecordsNotDuplicated: afterFirst.mistakeRecordCount === afterDuplicate.mistakeRecordCount,
    streakNotDoubleCounted: JSON.stringify(afterFirst.streak) === JSON.stringify(afterDuplicate.streak),
    milestonesNotDoubleCounted: afterFirst.milestoneCount === afterDuplicate.milestoneCount,
  };

  return {
    testUserId,
    sessionId: session.id,
    questionId,
    selectedOption,
    firstSubmitResult: firstResult,
    duplicateSubmitResult: duplicateResult,
    before,
    afterFirst,
    afterDuplicate,
    checks,
    allChecksPassed: Object.values(checks).every(Boolean),
  };
}
