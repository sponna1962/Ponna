process.env.PAYU_KEY = 'KEY123';
process.env.PAYU_SALT = 'SALT456';

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});
jest.mock('../practice-preference/milestone.service', () => ({ milestoneService: { checkAndAward: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./admin-alert.service', () => ({ adminAlertService: { notify: jest.fn() } }));

import { prisma } from '../../lib/prisma';
import { quoteCoupon, normalizeCode, createCoupon, CouponError } from './coupon.service';
import { PayuService } from './payu.service';

const db = prisma as unknown as DeepMockProxy<PrismaClient>;
const PASS = { id: 'p1', name: 'Pass', isFree: false, isTrial: false, active: true, launchPrice: null, regularPrice: 499 } as any;
const future = new Date(Date.now() + 3600_000);
const coupon = (over: any = {}) => ({ id: 'c1', code: 'PONNA-ABCDE', amountOff: 100, maxUses: 1, expiresAt: future, active: true, ...over }) as any;

beforeEach(() => {
  mockReset(db);
  db.plan.findMany.mockResolvedValue([PASS]);
  db.plan.findUnique.mockResolvedValue(PASS);
  db.payuPayment.count.mockResolvedValue(0 as any);
});

describe('normalizeCode', () => {
  it('uppercases and strips spaces/symbols', () => expect(normalizeCode(' ponna-ab cde! ')).toBe('PONNA-ABCDE'));
});

describe('quoteCoupon', () => {
  it('gives ₹399 for a valid ₹100 code', async () => {
    db.coupon.findUnique.mockResolvedValue(coupon());
    const q = await quoteCoupon('ponna-abcde');
    expect(q).toMatchObject({ price: 499, discount: 100, finalAmount: 399, planId: 'p1' });
  });
  it.each([
    ['unknown code', null],
    ['expired', coupon({ expiresAt: new Date(Date.now() - 1000) })],
    ['switched off', coupon({ active: false })],
  ])('rejects %s with the one generic message', async (_n, row) => {
    db.coupon.findUnique.mockResolvedValue(row as any);
    await expect(quoteCoupon('X1234')).rejects.toThrow(CouponError);
  });
  it('rejects a used-up code', async () => {
    db.coupon.findUnique.mockResolvedValue(coupon());
    db.payuPayment.count.mockResolvedValue(1 as any);
    await expect(quoteCoupon('PONNA-ABCDE')).rejects.toThrow(CouponError);
  });
  it('rejects a discount that is not smaller than the price', async () => {
    db.coupon.findUnique.mockResolvedValue(coupon({ amountOff: 499 }));
    await expect(quoteCoupon('PONNA-ABCDE')).rejects.toThrow(CouponError);
  });
  it('limits guessing to 8 tries per student', async () => {
    db.coupon.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 8; i++) await expect(quoteCoupon('BAD11', undefined, 'u-throttle')).rejects.toThrow('சரியில்லை');
    await expect(quoteCoupon('BAD11', undefined, 'u-throttle')).rejects.toThrow('10 நிமிடம்');
  });
});

describe('createCoupon', () => {
  it('rejects bad amounts', async () => {
    await expect(createCoupon({ amountOff: 0, maxUses: 1, hoursValid: 24 })).rejects.toThrow(CouponError);
    await expect(createCoupon({ amountOff: 500, maxUses: 1, hoursValid: 24 })).rejects.toThrow(CouponError);
  });
  it('makes a PONNA-xxxxx code when none is given', async () => {
    db.coupon.findUnique.mockResolvedValue(null);
    db.coupon.create.mockImplementation(async (a: any) => a.data);
    const c: any = await createCoupon({ amountOff: 100, maxUses: 1, hoursValid: 72 });
    expect(c.code).toMatch(/^PONNA-[A-Z2-9]{5}$/);
    expect(c.amountOff).toBe(100);
  });
});

describe('PayU checkout with a coupon', () => {
  it('charges the discounted amount and records the coupon', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Asha', email: 'a@x.in', phone: '9876543210' } as any);
    db.plan.findUniqueOrThrow.mockResolvedValue(PASS);
    db.coupon.findUnique.mockResolvedValue(coupon());
    db.payuPayment.create.mockResolvedValue({} as any);
    const out = await new PayuService().createCheckout('u1', 'p1', 'https://x/cb', 'ponna-abcde');
    expect(out.fields.amount).toBe('399.00');
    expect(db.payuPayment.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: '399.00', couponId: 'c1', discountAmount: 100 }) });
  });
  it('without a code still charges ₹499', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Asha', email: 'a@x.in', phone: '9876543210' } as any);
    db.plan.findUniqueOrThrow.mockResolvedValue(PASS);
    db.payuPayment.create.mockResolvedValue({} as any);
    const out = await new PayuService().createCheckout('u1', 'p1', 'https://x/cb');
    expect(out.fields.amount).toBe('499.00');
  });
  it('refuses a bad code instead of silently charging full price', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Asha', email: 'a@x.in', phone: '9876543210' } as any);
    db.plan.findUniqueOrThrow.mockResolvedValue(PASS);
    db.coupon.findUnique.mockResolvedValue(null);
    await expect(new PayuService().createCheckout('u1', 'p1', 'https://x/cb', 'NOPE1')).rejects.toThrow('சரியில்லை');
  });
});
