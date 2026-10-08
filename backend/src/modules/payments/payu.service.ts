// PayU gateway (Oct 2026). Flow:
//  1. createCheckout() -> the student's browser POSTs the returned fields to
//     PayU's hosted checkout (card / UPI / net banking are all handled there).
//  2. PayU POSTs the result to our callback. handleCallback() verifies PayU's
//     response HASH with our secret salt, checks the amount matches what we
//     asked for, and only then creates the Subscription — never trusting the
//     browser. The claim INITIATED -> SUCCESS and the Subscription creation
//     happen in ONE transaction, so a repeated callback cannot activate twice.
//
// Needs PAYU_KEY and PAYU_SALT (secret — set only in Render's environment).
// PAYU_MODE=test uses PayU's sandbox; anything else (default) is live.

import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { milestoneService } from '../practice-preference/milestone.service';
import { adminAlertService } from './admin-alert.service';

export class PayuError extends Error {}

const sha512 = (text: string) => crypto.createHash('sha512').update(text).digest('hex');

/** key|txnid|amount|productinfo|firstname|email|udf1..udf5||||||salt */
export function requestHash(f: { key: string; txnid: string; amount: string; productinfo: string; firstname: string; email: string }, salt: string): string {
  return sha512([f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, '', '', '', '', '', '', '', '', '', '', salt].join('|'));
}

/** [additionalCharges|]salt|status||||||udf5..udf1|email|firstname|productinfo|amount|txnid|key */
export function responseHash(p: Record<string, string | undefined>, salt: string): string {
  const parts = [salt, p.status ?? '', '', '', '', '', '', p.udf5 ?? '', p.udf4 ?? '', p.udf3 ?? '', p.udf2 ?? '', p.udf1 ?? '', p.email ?? '', p.firstname ?? '', p.productinfo ?? '', p.amount ?? '', p.txnid ?? '', p.key ?? ''];
  if (p.additionalCharges) parts.unshift(p.additionalCharges);
  return sha512(parts.join('|'));
}

function safeEqual(a: string, b: string): boolean {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a.toLowerCase()), Buffer.from(b.toLowerCase()));
}

const cleanText = (v: string, max: number) => v.replace(/[^\p{L}\p{N} .,-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export type CallbackOutcome = 'success' | 'failed' | 'invalid';

export class PayuService {
  private config() {
    const key = process.env.PAYU_KEY?.trim();
    const salt = process.env.PAYU_SALT?.trim();
    const test = process.env.PAYU_MODE?.trim().toLowerCase() === 'test';
    return { key, salt, test, enabled: !!key && !!salt, action: test ? 'https://test.payu.in/_payment' : 'https://secure.payu.in/_payment' };
  }

  isEnabled() {
    return this.config().enabled;
  }

  /** Builds the form fields the browser must POST to PayU. */
  async createCheckout(userId: string, planId: string, callbackUrl: string) {
    const cfg = this.config();
    if (!cfg.enabled || !cfg.key || !cfg.salt) throw new PayuError('Online payment is not available right now.');

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
    if (plan.isFree || !plan.active) throw new PayuError(`${plan.name} is not available for purchase.`);
    const price = plan.launchPrice ?? plan.regularPrice;
    if (!price) throw new PayuError(`No price set for ${plan.name}.`);

    const amount = Number(price).toFixed(2);
    const txnid = `PN${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`.toUpperCase();
    const fields = {
      key: cfg.key,
      txnid,
      amount,
      productinfo: cleanText(plan.name, 100) || 'PONNA Pass',
      firstname: cleanText(user.name ?? '', 50) || 'Student',
      // PayU requires an email; students who signed up by phone get a placeholder.
      email: user.email ?? `${user.id}@students.ponna.in`,
      phone: (user.phone ?? '').replace(/\D/g, '').slice(-10),
      surl: callbackUrl,
      furl: callbackUrl,
    };
    const hash = requestHash(fields, cfg.salt);

    await prisma.payuPayment.create({ data: { txnid, userId, planId, amount } });
    return { action: cfg.action, fields: { ...fields, hash } };
  }

  /** Verifies PayU's POST and fulfils the order. Never throws for a bad request. */
  async handleCallback(params: Record<string, string | undefined>): Promise<{ outcome: CallbackOutcome; txnid?: string }> {
    const cfg = this.config();
    if (!cfg.enabled || !cfg.salt || !cfg.key) return { outcome: 'invalid' };
    const txnid = params.txnid;
    if (!txnid || !params.hash || params.key !== cfg.key) return { outcome: 'invalid' };
    if (!safeEqual(responseHash(params, cfg.salt), params.hash)) return { outcome: 'invalid' };

    const payment = await prisma.payuPayment.findUnique({ where: { txnid } });
    if (!payment) return { outcome: 'invalid', txnid };
    if (payment.status === 'SUCCESS') return { outcome: 'success', txnid };

    if ((params.status ?? '').toLowerCase() !== 'success') {
      await prisma.payuPayment.updateMany({
        where: { id: payment.id, status: 'INITIATED' },
        data: { status: 'FAILED', failureReason: (params.error_Message || params.error || params.status || 'failed').slice(0, 200) },
      });
      return { outcome: 'failed', txnid };
    }

    // Money received must equal the price we asked for.
    if (Math.abs(Number(params.amount) - Number(payment.amount)) > 0.001) {
      await prisma.payuPayment.updateMany({ where: { id: payment.id, status: 'INITIATED' }, data: { status: 'FAILED', failureReason: 'Amount mismatch' } });
      adminAlertService.notify('⚠️ PONNA: PayU தொகை பொருந்தவில்லை', `txn ${txnid}: expected ${payment.amount}, PayU says ${params.amount}`);
      return { outcome: 'failed', txnid };
    }

    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: payment.planId } });
    const created = await prisma.$transaction(async (tx) => {
      const claim = await tx.payuPayment.updateMany({ where: { id: payment.id, status: 'INITIATED' }, data: { status: 'SUCCESS', mihpayid: params.mihpayid ?? null } });
      if (claim.count === 0) return null; // another callback already fulfilled it
      const cycleStart = new Date();
      const cycleEnd = new Date(cycleStart);
      cycleEnd.setDate(cycleEnd.getDate() + (plan.cycleDays ?? 365));
      const sub = await tx.subscription.create({ data: { userId: payment.userId, planId: plan.id, cycleStart, cycleEnd, status: 'ACTIVE' } });
      await tx.payuPayment.update({ where: { id: payment.id }, data: { subscriptionId: sub.id } });
      return sub;
    });

    if (created) {
      milestoneService.checkAndAward(payment.userId).catch((err) => console.error('Milestone check failed after PayU payment:', err));
      adminAlertService.notify('✅ PONNA: PayU பணம் வந்தது', `${plan.name} · ₹${payment.amount} · txn ${txnid}`);
    }
    return { outcome: 'success', txnid };
  }
}

export const payuService = new PayuService();
