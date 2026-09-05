// Parent/Mentor Progress Sharing (finalized requirement — world-class
// polish, item 2). Student-initiated, revocable, read-only public link.
// Only ever exposes safe, non-PII summary data (name, overall accuracy,
// streak, subject-level performance) -- never phone/email or anything
// else from the account.

import { prisma } from '../../lib/prisma';

export class ShareProgressService {
  async getStatus(userId: string) {
    const existing = await prisma.shareToken.findUnique({ where: { userId } });
    if (!existing || existing.revoked) return { active: false as const };
    return { active: true as const, token: existing.token };
  }

  /** Idempotent -- returns the existing active token if one exists,
   * otherwise creates a new one (or reactivates a revoked one, so the
   * student doesn't accumulate multiple dead rows over time). */
  async createOrGetToken(userId: string) {
    const existing = await prisma.shareToken.findUnique({ where: { userId } });
    if (existing && !existing.revoked) return { token: existing.token };
    if (existing && existing.revoked) {
      const updated = await prisma.shareToken.update({ where: { userId }, data: { revoked: false } });
      return { token: updated.token };
    }
    const created = await prisma.shareToken.create({ data: { userId } });
    return { token: created.token };
  }

  async revoke(userId: string) {
    await prisma.shareToken.updateMany({ where: { userId }, data: { revoked: true } });
  }

  /** Public, unauthenticated read -- returns null for any unknown or
   * revoked token, never distinguishing between the two (no information
   * leak about whether a token ever existed). */
  async getPublicSummary(token: string) {
    const shareToken = await prisma.shareToken.findUnique({ where: { token } });
    if (!shareToken || shareToken.revoked) return null;

    const [user, performance, streak] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: shareToken.userId }, select: { name: true } }),
      prisma.userPerformanceSummary.findMany({ where: { userId: shareToken.userId } }),
      prisma.user.findUniqueOrThrow({ where: { id: shareToken.userId }, select: { currentStreak: true, longestStreak: true } }),
    ]);

    const overall = performance.find((p) => p.bucket === 'OVERALL');

    return {
      name: user.name ?? 'Student',
      overallAccuracy: overall ? Math.round(overall.averagePercent) : null,
      questionsAnswered: overall?.questionsAnswered ?? 0,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      byDifficulty: performance
        .filter((p) => p.bucket !== 'OVERALL')
        .map((p) => ({ bucket: p.bucket, accuracy: Math.round(p.averagePercent), questionsAnswered: p.questionsAnswered })),
    };
  }
}
