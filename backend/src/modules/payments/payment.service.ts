// Payment Service — Razorpay integration for Annual Plan purchases.
// Plans are dynamic (Phase 1/2 redesign) — identified by planId, not a
// hardcoded code. Two responsibilities: (1) create a Razorpay order for the
// student to pay against, (2) verify and process the webhook Razorpay sends
// on success, which is the ONLY place a Subscription actually gets created —
// never trust a client-side "payment succeeded" callback alone, since that
// can be spoofed.
//
// Requires RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET
// in the environment (see .env.example) — these come from your Razorpay
// business account, which is a real account/decision only you can set up.

import { prisma } from '../../lib/prisma';
import crypto from 'crypto';
import { isProfileComplete } from '../profile/profile.service';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

export class ProfileIncompleteError extends Error {
  constructor() {
    super('Please complete your profile (district, city/town/village, preparing for) before purchasing a plan.');
    this.name = 'ProfileIncompleteError';
  }
}

export class PaymentService {
  /**
   * Creates a Razorpay order for the given Plan. The frontend uses the
   * returned order id to open Razorpay's checkout widget. No Subscription
   * exists yet at this point — it's only created once the webhook confirms
   * payment actually succeeded.
   *
   * Charges launchPrice when set, otherwise regularPrice — no countdown
   * timer, just whichever the admin currently has configured (finalized
   * requirement).
   *
   * Profile completion is required before payment — checked server-side,
   * not just hidden in the UI, since a paid plan is exactly the kind of
   * action that shouldn't be bypassable by calling the API directly.
   */
  async createOrder(userId: string, planId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!isProfileComplete(user)) {
      throw new ProfileIncompleteError();
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    if (plan.isFree) {
      throw new Error('The Free plan has no payment — start practicing directly.');
    }
    const price = plan.launchPrice ?? plan.regularPrice;
    if (!price) {
      throw new Error(`No price set for ${plan.name} — set it from the admin Plans screen first.`);
    }
    if (!plan.active) {
      throw new Error(`${plan.name} is not currently available for purchase.`);
    }

    const amountInPaise = Math.round(Number(price) * 100);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64'),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        // Encoded into notes so the webhook (which only receives Razorpay's
        // own order/payment IDs) can map back to who bought what.
        notes: { userId, planId },
      }),
    });

    if (!response.ok) {
      throw new Error(`Razorpay order creation failed: ${response.status} ${await response.text()}`);
    }

    const order = (await response.json()) as { id: string; amount: number; currency: string };
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID };
  }

  /** Verifies the webhook signature — reject anything that doesn't check out. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is not set — cannot verify webhook authenticity.');
    }
    const expected = crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    // Timing-safe comparison — avoids leaking signature-matching info via response timing.
    return (
      expected.length === signatureHeader.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
    );
  }

  /**
   * Processes a verified `payment.captured` webhook event: creates the
   * Subscription (365-day cycle from now, per the finalized 12-month
   * validity rule). Idempotent on Razorpay's payment id, since webhooks can
   * be (and are, by Razorpay's own design) delivered more than once.
   */
  async handlePaymentCaptured(event: any) {
    const payment = event.payload?.payment?.entity;
    if (!payment) throw new Error('Malformed webhook payload — missing payment entity');

    const razorpayPaymentId: string = payment.id;
    const notes = payment.notes ?? {};
    const userId: string | undefined = notes.userId;
    const planId: string | undefined = notes.planId;

    if (!userId || !planId) {
      throw new Error(`Webhook payment ${razorpayPaymentId} is missing userId/planId in notes — cannot fulfil.`);
    }

    // Idempotency guard: if we've already recorded this exact payment, don't
    // create a second subscription for a retried webhook delivery.
    const alreadyProcessed = await prisma.subscription.findUnique({ where: { razorpayPaymentId } });
    if (alreadyProcessed) {
      return { status: 'already_processed', subscriptionId: alreadyProcessed.id };
    }

    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    const cycleStart = new Date();
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + (plan.cycleDays ?? 365));

    // Manual renewal only — this always creates a fresh 12-month cycle,
    // never extends an existing one. A student may hold several concurrent
    // active Subscriptions across different Plans (finalized requirement),
    // so this never touches/replaces any of their other active plans.
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        cycleStart,
        cycleEnd,
        status: 'ACTIVE',
        razorpayPaymentId,
      },
    });

    return { status: 'created', subscriptionId: subscription.id };
  }
}
