// Discount coupons (Oct 2026). Codes are never listed in the student app; the
// owner hands one out by phone/WhatsApp and the student types it on /coupon.
// The discount is applied on the SERVER when the PayU order is created, so the
// amount PayU charges (and later verifies in the callback) already includes it.

import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export class CouponError extends Error {}

const GENERIC = 'இந்தக் குறியீடு சரியில்லை அல்லது காலாவதியாகிவிட்டது.';

export function normalizeCode(raw: unknown): string {
  return String(raw ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30);
}

// Slow down guessing: at most 8 tries per student per 10 minutes.
const attempts = new Map<string, number[]>();
function throttle(userId: string) {
  const now = Date.now();
  const recent = (attempts.get(userId) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 8) throw new CouponError('பலமுறை முயன்றுவிட்டீர்கள். 10 நிமிடம் கழித்து மீண்டும் முயலுங்கள்.');
  recent.push(now);
  attempts.set(userId, recent);
}

/** The paid, non-trial plan a coupon applies to (the Pass). */
async function passPlan(planId?: string) {
  if (planId) return prisma.plan.findUnique({ where: { id: planId } });
  const plans = await prisma.plan.findMany({ where: { active: true, isFree: false, isTrial: false } });
  const priced = plans.filter((p: any) => (p.launchPrice ?? p.regularPrice) != null);
  priced.sort((a: any, b: any) => Number(a.launchPrice ?? a.regularPrice) - Number(b.launchPrice ?? b.regularPrice));
  return priced[0] ?? null;
}

async function usedCount(couponId: string): Promise<number> {
  return prisma.payuPayment.count({ where: { couponId, status: 'SUCCESS' } });
}

export interface CouponQuote {
  couponId: string;
  code: string;
  planId: string;
  planName: string;
  price: number;
  discount: number;
  finalAmount: number;
  expiresAt: Date;
}

/** Validates a code for a plan. Throws CouponError with one generic message. */
export async function quoteCoupon(rawCode: unknown, planId?: string, userId?: string): Promise<CouponQuote> {
  if (userId) throttle(userId);
  const code = normalizeCode(rawCode);
  if (!code) throw new CouponError(GENERIC);
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.active || coupon.expiresAt.getTime() <= Date.now()) throw new CouponError(GENERIC);
  if ((await usedCount(coupon.id)) >= coupon.maxUses) throw new CouponError(GENERIC);

  const plan = await passPlan(planId);
  if (!plan || plan.isFree || plan.isTrial || !plan.active) throw new CouponError('இந்தக் குறியீடு இந்தத் திட்டத்துக்குப் பொருந்தாது.');
  const price = Number(plan.launchPrice ?? plan.regularPrice ?? 0);
  const discount = Number(coupon.amountOff);
  if (price <= 0 || discount <= 0 || discount >= price) throw new CouponError(GENERIC);
  return { couponId: coupon.id, code: coupon.code, planId: plan.id, planName: plan.name, price, discount, finalAmount: price - discount, expiresAt: coupon.expiresAt };
}

// ---- Admin ----

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return `PONNA-${out}`;
}

export async function createCoupon(input: { code?: string; amountOff: number; maxUses: number; hoursValid: number; note?: string }) {
  const amountOff = Math.round(Number(input.amountOff));
  const maxUses = Math.floor(Number(input.maxUses));
  const hours = Number(input.hoursValid);
  if (!(amountOff >= 1 && amountOff <= 400)) throw new CouponError('தள்ளுபடி ₹1 முதல் ₹400 வரை இருக்க வேண்டும்.');
  if (!(maxUses >= 1 && maxUses <= 1000)) throw new CouponError('எத்தனை பேர் பயன்படுத்தலாம் என்பது 1 முதல் 1000 வரை இருக்க வேண்டும்.');
  if (!(hours >= 1 && hours <= 24 * 60)) throw new CouponError('செல்லுபடியாகும் நேரம் 1 மணி முதல் 60 நாட்கள் வரை இருக்க வேண்டும்.');
  let code = normalizeCode(input.code);
  if (input.code && code.length < 4) throw new CouponError('குறியீடு குறைந்தது 4 எழுத்துகள் இருக்க வேண்டும்.');
  if (!code) {
    for (let i = 0; i < 5 && !code; i++) {
      const c = randomCode();
      if (!(await prisma.coupon.findUnique({ where: { code: c } }))) code = c;
    }
  } else if (await prisma.coupon.findUnique({ where: { code } })) {
    throw new CouponError('இந்தக் குறியீடு ஏற்கனவே உள்ளது.');
  }
  return prisma.coupon.create({
    data: { code, amountOff, maxUses, expiresAt: new Date(Date.now() + hours * 3600 * 1000), note: input.note?.trim().slice(0, 200) || null },
  });
}

export async function listCoupons() {
  const rows = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { payments: { where: { status: 'SUCCESS' }, select: { id: true } } },
  });
  return rows.map((c: any) => ({
    id: c.id, code: c.code, amountOff: Number(c.amountOff), maxUses: c.maxUses, used: c.payments.length,
    expiresAt: c.expiresAt, active: c.active, note: c.note, createdAt: c.createdAt,
  }));
}

export async function deactivateCoupon(id: string) {
  await prisma.coupon.update({ where: { id }, data: { active: false } });
}
