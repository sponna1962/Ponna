// Student Management Service — implements §7.5 (View student statistics).
// Read-focused: admin panel needs to see who's using the platform, on what
// plan, and how they're performing — not edit student data directly (a
// student's own account changes go through their own flow, not admin edits).

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

  /** Aggregate platform stats for a simple overview at the top of the student list (§7.5). */
  async getPlatformStats() {
    const [totalStudents, activeSubscriptions, totalSessionsCompleted, totalQuestionsAnswered] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE', plan: { code: { in: ['PLAN_20', 'PLAN_50'] } } } }),
      prisma.quizSession.count({ where: { status: 'COMPLETED' } }),
      prisma.userQuestionHistory.count(),
    ]);

    return { totalStudents, activeSubscriptions, totalSessionsCompleted, totalQuestionsAnswered };
  }
}
