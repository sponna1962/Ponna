// Student Management Service — implements §7.5 (View student statistics).
// Read-focused: admin panel needs to see who's using the platform, on what
// plan, and how they're performing — not edit student data directly (a
// student's own account changes go through their own flow, not admin edits).

import { prisma } from '../../lib/prisma';

export class StudentManagementService {
  async listStudents(opts: { search?: string; page?: number; pageSize?: number }) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 50;

    const where = opts.search
      ? {
          OR: [
            { phone: { contains: opts.search } },
            { email: { contains: opts.search, mode: 'insensitive' as const } },
            { name: { contains: opts.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          subscriptions: { where: { status: 'ACTIVE' }, include: { plan: true }, take: 1, orderBy: { cycleStart: 'desc' } },
          performanceSummary: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        preferredLang: u.preferredLang,
        createdAt: u.createdAt,
        isTestAccount: u.isTestAccount,
        flaggedSuspicious: u.flaggedSuspicious,
        flaggedReason: u.flaggedReason,
        activePlan: u.subscriptions[0]?.plan.name ?? 'Free',
        performance: u.performanceSummary.reduce((acc, p) => {
          acc[p.bucket] = { questionsAnswered: p.questionsAnswered, averagePercent: p.averagePercent, rank: p.rank };
          return acc;
        }, {} as Record<string, unknown>),
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Super Admin only (enforced at the route level) — toggle Test Account status. */
  async setTestAccount(userId: string, isTestAccount: boolean) {
    return prisma.user.update({ where: { id: userId }, data: { isTestAccount }, select: { id: true, isTestAccount: true } });
  }

  /** Super Admin only — clears a suspicious-usage flag after review
   * (finalized requirement: only a human review clears it, the sweep
   * itself never auto-clears). Also resets nearCapStreak so a genuinely
   * resolved case doesn't immediately re-trigger tomorrow purely from
   * yesterday's already-reviewed streak. */
  async clearSuspiciousFlag(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { flaggedSuspicious: false, flaggedReason: null, flaggedAt: null, nearCapStreak: 0 },
      select: { id: true, flaggedSuspicious: true },
    });
  }

  /**
   * Super Admin only — changes the phone number on an EXISTING account,
   * keeping every bit of its history/data (subscriptions, quiz history,
   * Daily Quiz attempts, everything keyed to this userId) exactly as is.
   * Different from student-auth.service.ts's linkPhoneNumber (which is
   * self-service, OTP-verified, and only for adding a phone that wasn't
   * there before) — this is a trusted admin override for the "same
   * account, different number" case, e.g. a lost SIM or a test account
   * being repointed at a new number. Since it bypasses OTP verification
   * of the new number, it's Super-Admin-only and should be used
   * deliberately, not as a self-service flow.
   */
  async changePhoneNumber(userId: string, newPhoneRaw: string) {
    // Real Firebase Phone-OTP logins always store phone in E.164 format
    // (e.g. "+919965399896" — see student-auth.service.ts's
    // `decoded.phone_number`, used verbatim, no reformatting). An admin
    // typing just "9965399896" here would otherwise be stored WITHOUT the
    // "+91" prefix — a silent format mismatch that makes the very next
    // real OTP login for that number fail to resolve back to this
    // account (it would instead create a brand-new, unrelated one,
    // losing isTestAccount/history access entirely). Normalize here so
    // the stored value always matches what a real OTP login will send.
    const digits = newPhoneRaw.replace(/[^\d]/g, '');
    const newPhone = newPhoneRaw.trim().startsWith('+') ? newPhoneRaw.trim() : `+91${digits.replace(/^91/, '').slice(-10)}`;

    const conflict = await prisma.user.findUnique({ where: { phone: newPhone } });
    if (conflict && conflict.id !== userId) {
      throw new Error(`This phone number is already linked to a different account (as ${newPhone}). Remove/reassign that account's phone first.`);
    }
    return prisma.user.update({ where: { id: userId }, data: { phone: newPhone }, select: { id: true, phone: true } });
  }

  /**
   * Super Admin only — permanently deletes a student account and every
   * record tied to it: Devices, Subscriptions, Practice Preference, quiz
   * history (QuizSession + its QuizSessionQuestion rows,
   * UserQuestionHistory, UserPerformanceSummary), Question Reports, and
   * Daily Quiz activity (DailyQuizAttempt + its DailyQuizAnswer rows).
   * Irreversible — the route requires an explicit confirmation on the
   * frontend before calling this.
   */
  async deleteStudentAccount(userId: string): Promise<void> {
    await prisma.dailyQuizAnswer.deleteMany({ where: { attempt: { userId } } });
    await prisma.dailyQuizAttempt.deleteMany({ where: { userId } });
    await prisma.quizSessionQuestion.deleteMany({ where: { session: { userId } } });
    await prisma.quizSession.deleteMany({ where: { userId } });
    await prisma.userQuestionHistory.deleteMany({ where: { userId } });
    await prisma.userPerformanceSummary.deleteMany({ where: { userId } });
    await prisma.device.deleteMany({ where: { userId } });
    await prisma.questionReport.deleteMany({ where: { userId } });
    await prisma.studentPracticePreference.deleteMany({ where: { userId } });
    await prisma.subscription.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }

  async getStudentDetail(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        subscriptions: { orderBy: { cycleStart: 'desc' }, include: { plan: true } },
        performanceSummary: true,
        quizSessions: { orderBy: { startedAt: 'desc' }, take: 20 },
      },
    });
    return user;
  }

  /** Aggregate platform stats for a simple overview at the top of the student list (§7.5).
   * Test Accounts are excluded — QA activity shouldn't inflate real usage numbers. */
  async getPlatformStats() {
    const [totalStudents, activeSubscriptions, totalSessionsCompleted, totalQuestionsAnswered] = await Promise.all([
      prisma.user.count({ where: { isTestAccount: false } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', cycleEnd: { gt: new Date() }, plan: { isFree: false }, user: { isTestAccount: false } } }),
      prisma.quizSession.count({ where: { status: 'COMPLETED', user: { isTestAccount: false } } }),
      prisma.userQuestionHistory.count({ where: { user: { isTestAccount: false } } }),
    ]);

    return { totalStudents, activeSubscriptions, totalSessionsCompleted, totalQuestionsAnswered };
  }
}
