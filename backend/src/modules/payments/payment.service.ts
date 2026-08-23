// Payment Service — Razorpay integration for Plan 20 / Plan 50 purchases.
// Two responsibilities: (1) create a Razorpay order for the student to pay
// against, (2) verify and process the webhook Razorpay sends on success,
// which is the ONLY place a Subscription actually gets created — never trust
// a client-side "payment succeeded" callback alone, since that can be spoofed.
//
// Requires RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET
// in the environment (see .env.example) — these come from your Razorpay
// business account, which is a real account/decision only you can set up.

import { PrismaClient, PlanCode } from '@prisma/client';
import crypto from 'crypto';
import { isProfileComplete } from '../profile/profile.service';

const prisma = new PrismaClient();
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
   * Creates a Razorpay order for the given plan. The frontend uses the
   * returned order id to open Razorpay's checkout widget. No Subscription
   * exists yet at this point — it's only created once the webhook confirms
   * payment actually succeeded.
   *
   * Profile completion is required before payment (profile-completion
   * requirement) — checked server-side, not just hidden in the UI, since a
   * paid plan is exactly the kind of action that shouldn't be bypassable by
   * calling the API directly.
   */
  async createOrder(userId: string, planCode: PlanCode) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!isProfileComplete(user)) {
      throw new ProfileIncompleteError();
    }

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
    }

    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: planCode } });
    if (!plan.price) {
      throw new Error(`No price set for ${plan.name} — set it from the admin Plans screen first.`);
    }
    if (!plan.active) {
      throw new Error(`${plan.name} is not currently available for purchase.`);
    }

    const amountInPaise = Math.round(Number(plan.price) * 100);

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
        notes: { userId, planCode },
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
   * Subscription. Idempotent on Razorpay's payment id, since webhooks can be
   * (and are, by Razorpay's own design) delivered more than once.
   */
  async handlePaymentCaptured(event: any) {
    const payment = event.payload?.payment?.entity;
    if (!payment) throw new Error('Malformed webhook payload — missing payment entity');

    const razorpayPaymentId: string = payment.id;
    const notes = payment.notes ?? {};
    const userId: string | undefined = notes.userId;
    const planCode: PlanCode | undefined = notes.planCode;

    if (!userId || !planCode) {
      throw new Error(`Webhook payment ${razorpayPaymentId} is missing userId/planCode in notes — cannot fulfil.`);
    }

    // Idempotency guard: if we've already recorded this exact payment, don't
    // create a second subscription for a retried webhook delivery.
    const alreadyProcessed = await prisma.subscription.findUnique({ where: { razorpayPaymentId } });
    if (alreadyProcessed) {
      return { status: 'already_processed', subscriptionId: alreadyProcessed.id };
    }

    const plan = await prisma.plan.findUniqueOrThrow({ where: { code: planCode } });
    const cycleStart = new Date();
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleEnd.getDate() + plan.cycleDays);

    // Manual renewal only (§5) — this always creates a fresh cycle, never
    // extends or tops up an existing one, and unused quota from any prior
    // cycle is simply left behind (no carry-forward, per the requirements doc).
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
