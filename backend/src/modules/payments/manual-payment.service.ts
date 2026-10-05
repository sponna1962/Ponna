// Manual UPI payments (Oct 2026) — interim way to take payment while no
// payment gateway is approved. Flow: student pays the business UPI ID in
// their own UPI app -> submits the 12-digit UTR here -> admin checks the
// money actually arrived in the bank/UPI app -> approves -> a normal
// Subscription is created (same 12-month rules as the Razorpay webhook).
//
// Enabled only when UPI_ID is set in the environment, so nothing changes
// until the owner decides to turn it on. UPI_PAYEE_NAME is optional.

import { prisma } from '../../lib/prisma';
import type { ManualPaymentStatus } from '@prisma/client';
import { isProfileComplete } from '../profile/profile.service';
import { milestoneService } from '../practice-preference/milestone.service';
import { ProfileIncompleteError } from './payment.service';
import { adminAlertService } from './admin-alert.service';
import { customerNotifyService } from './customer-notify.service';

export class ManualPaymentError extends Error {}

// UPI transaction references (UTR / UPI Ref No.) are 12 digits.
const UTR_PATTERN = /^\d{12}$/;

export class ManualPaymentService {
  getInfo() {
    const upiId = process.env.UPI_ID?.trim();
    return {
      enabled: !!upiId,
      upiId: upiId ?? null,
      payeeName: process.env.UPI_PAYEE_NAME?.trim() || 'PONNA',
    };
  }

  async submit(userId: string, planId: string, rawUtr: string) {
    if (!this.getInfo().enabled) throw new ManualPaymentError('UPI payment is not available right now.');

    const utr = String(rawUtr ?? '').replace(/\s+/g, '');
    if (!UTR_PATTERN.test(utr)) {
      throw new ManualPaymentError('Please enter the 12-digit UPI transaction ID (UTR) shown in your UPI app.');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!isProfileComplete(user)) throw new ProfileIncompleteError();

    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    if (plan.isFree || !plan.active) throw new ManualPaymentError(`${plan.name} is not available for purchase.`);
    const price = plan.launchPrice ?? plan.regularPrice;
    if (!price) throw new ManualPaymentError(`No price set for ${plan.name}.`);

    const duplicate = await prisma.manualPayment.findUnique({ where: { utr } });
    if (duplicate) {
      // Same UTR twice is either an honest double-tap (same student) or an
      // attempt to reuse someone else's payment — the owner should know.
      const sameUser = duplicate.userId === userId;
      adminAlertService.notify(
        sameUser ? 'ℹ️ PONNA: UTR மீண்டும் சமர்ப்பிக்கப்பட்டது' : '⚠️ PONNA: வேறொருவரின் UTR பயன்படுத்த முயற்சி',
        `${user.name ?? '—'} · ${user.phone ?? user.email ?? '—'}\nUTR ${utr} (${duplicate.status})`,
      );
      throw new ManualPaymentError(
        sameUser
          ? 'You have already submitted this transaction ID. We are verifying it.'
          : 'This transaction ID has already been used. Please check the number in your UPI app, or email ponna@arlena.in.',
      );
    }

    const pending = await prisma.manualPayment.findFirst({ where: { userId, planId, status: 'PENDING' } });
    if (pending) throw new ManualPaymentError('You already have a payment waiting for approval for this plan.');

    const created = await prisma.manualPayment.create({ data: { userId, planId, amount: price, utr } });
    adminAlertService.notify(
      `💰 PONNA: புதிய UPI பணம் ₹${price}`,
      `${plan.name}\n${user.name ?? '—'} · ${user.phone ?? '—'} · ${user.email ?? '—'}\nUTR ${utr}\nவங்கியில் சரிபார்த்து Approve செய்யுங்கள்.`,
    );
    customerNotifyService.paymentEvent(userId, planId, 'RECEIVED', utr, price.toString());
    return created;
  }

  /** Student-reported problem (e.g. "I paid but cannot submit"). Alerts the owner at once. */
  async reportProblem(userId: string, message: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const text = String(message ?? '').trim().slice(0, 500);
    if (!text) throw new ManualPaymentError('Please describe the problem.');
    adminAlertService.notify(
      '🆘 PONNA: வாடிக்கையாளர் உதவி கோருகிறார்',
      `${user.name ?? '—'} · ${user.phone ?? '—'} · ${user.email ?? '—'}\n${text}`,
      '/admin/students',
    );
  }

  pendingCount() {
    return prisma.manualPayment.count({ where: { status: 'PENDING' } });
  }

  /** The student's own submissions, so the Plans page can show "waiting for approval". */
  listForUser(userId: string) {
    return prisma.manualPayment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, planId: true, amount: true, status: true, adminNote: true, createdAt: true },
    });
  }

  listForAdmin(status?: string) {
    const where: { status?: ManualPaymentStatus } =
      status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED' ? { status } : {};
    return prisma.manualPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { name: true, phone: true, email: true } },
        plan: { select: { name: true } },
      },
    });
  }

  async approve(id: string, staffId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const mp = await tx.manualPayment.findUniqueOrThrow({ where: { id }, include: { plan: true } });
      // Idempotent: a double-click or retry must never create a second subscription.
      if (mp.status !== 'PENDING') throw new ManualPaymentError(`Already ${mp.status.toLowerCase()}.`);

      const cycleStart = new Date();
      const cycleEnd = new Date(cycleStart);
      cycleEnd.setDate(cycleEnd.getDate() + (mp.plan.cycleDays ?? 365));

      const subscription = await tx.subscription.create({
        data: { userId: mp.userId, planId: mp.planId, cycleStart, cycleEnd, status: 'ACTIVE' },
      });
      await tx.manualPayment.update({
        where: { id },
        data: { status: 'APPROVED', subscriptionId: subscription.id, reviewedById: staffId, reviewedAt: new Date() },
      });
      return { userId: mp.userId, subscriptionId: subscription.id, planId: mp.planId, utr: mp.utr, amount: mp.amount.toString() };
    });

    customerNotifyService.paymentEvent(result.userId, result.planId, 'APPROVED', result.utr, result.amount);
    milestoneService.checkAndAward(result.userId).catch((err) => console.error('Milestone check failed after manual payment:', err));
    return result;
  }

  async reject(id: string, staffId: string, note?: string) {
    const mp = await prisma.manualPayment.findUniqueOrThrow({ where: { id } });
    if (mp.status !== 'PENDING') throw new ManualPaymentError(`Already ${mp.status.toLowerCase()}.`);
    const updated = await prisma.manualPayment.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: note?.slice(0, 300) || null, reviewedById: staffId, reviewedAt: new Date() },
    });
    customerNotifyService.paymentEvent(mp.userId, mp.planId, 'REJECTED', mp.utr, mp.amount.toString(), updated.adminNote);
    return updated;
  }
}
