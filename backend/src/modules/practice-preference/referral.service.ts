// Referral Program (finalized requirement — world-class growth item 3,
// STRUCTURE ONLY per explicit instruction). The reward trigger ("mark
// REWARDED") is not yet wired to an automated payment-confirmation
// event, since Razorpay isn't integrated -- markRewarded() exists and is
// correct, it just isn't called from anywhere yet. Once Razorpay webhook
// handling is built, that code should call markRewarded(refereeId) right
// after confirming the referee's first successful payment.

import { prisma } from '../../lib/prisma';

function generateReferralCode(): string {
  // Short, shareable, unambiguous (no 0/O/1/I confusion).
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export class ReferralService {
  /** Lazily generates a code on first access -- never required at
   * signup, and retried on a rare collision (the 6-char alphabet gives
   * ~1 billion combinations, so this is a defensive loop, not an
   * expected hot path). */
  async getOrCreateCode(userId: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (user.referralCode) return user.referralCode;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      try {
        await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return code;
      } catch {
        continue; // unique collision, retry
      }
    }
    throw new Error('Could not generate a unique referral code — please try again.');
  }

  async getMyReferrals(userId: string) {
    const conversions = await prisma.referralConversion.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { }, // referee's name is intentionally NOT joined/exposed here — keep this list to counts/status only, not another student's identity
    });
    return {
      totalReferred: conversions.length,
      totalRewarded: conversions.filter((c) => c.status === 'REWARDED').length,
      pending: conversions.filter((c) => c.status === 'PENDING').length,
    };
  }

  /** Called once, at signup, if a valid referral code was present in the
   * URL. Silently no-ops for an unknown code, a self-referral attempt, or
   * a referee who already has a referredBy set (first one wins,
   * referredBy is never overwritten). */
  async recordReferralIfPresent(refereeUserId: string, referralCodeUsed: string | undefined | null): Promise<void> {
    if (!referralCodeUsed) return;

    const referrer = await prisma.user.findUnique({ where: { referralCode: referralCodeUsed.toUpperCase() } });
    if (!referrer || referrer.id === refereeUserId) return;

    const referee = await prisma.user.findUniqueOrThrow({ where: { id: refereeUserId }, select: { referredById: true } });
    if (referee.referredById) return; // already attributed to a different referral, never overwritten

    await prisma.user.update({ where: { id: refereeUserId }, data: { referredById: referrer.id } });
    await prisma.referralConversion.create({ data: { referrerId: referrer.id, refereeId: refereeUserId } }).catch(() => {}); // refereeId unique -- a rare race is safe to ignore
  }

  /** NOT YET CALLED FROM ANYWHERE (see file header) -- exists ready for
   * the Razorpay payment-confirmation webhook to call once that
   * integration exists. */
  async markRewarded(refereeId: string): Promise<void> {
    await prisma.referralConversion.updateMany({
      where: { refereeId, status: 'PENDING' },
      data: { status: 'REWARDED', rewardedAt: new Date() },
    });
  }
}
