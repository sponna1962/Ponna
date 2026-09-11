// Unit tests for PaymentService — Razorpay webhook signature
// verification, idempotent subscription creation, createOrder's guard
// checks. Mocked Prisma client — no real database, and no real network
// call to Razorpay (global fetch is mocked for createOrder tests).
// RAZORPAY_* env vars are read at MODULE LOAD TIME in payment.service.ts
// (top-level consts) — set BEFORE the first import below so the
// "happy path" tests see them, and re-imported via jest.resetModules()
// for the "not configured" tests that need them absent. These tests
// verify the CURRENT business rules as implemented; they do not
// introduce new behaviour.

process.env.RAZORPAY_KEY_ID = 'test-key-id';
process.env.RAZORPAY_KEY_SECRET = 'test-key-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});
jest.mock('../profile/profile.service', () => ({ isProfileComplete: jest.fn() }));
jest.mock('../practice-preference/milestone.service');

import { prisma } from '../../lib/prisma';
import { PaymentService, ProfileIncompleteError } from './payment.service';
import { isProfileComplete } from '../profile/profile.service';
import { milestoneService } from '../practice-preference/milestone.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-1';
const PLAN_ID = 'plan-1';

function webhookEvent(overrides: { paymentId?: string; userId?: string | null; planId?: string | null } = {}) {
  const userId = 'userId' in overrides ? overrides.userId : USER_ID;
  const planId = 'planId' in overrides ? overrides.planId : PLAN_ID;
  const notes: Record<string, string> = {};
  if (userId) notes.userId = userId;
  if (planId) notes.planId = planId;
  return {
    payload: {
      payment: {
        entity: {
          id: overrides.paymentId ?? 'pay_123',
          notes,
        },
      },
    },
  };
}

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    mockReset(prismaMock);
    jest.clearAllMocks();
    service = new PaymentService();
    (milestoneService.checkAndAward as jest.Mock).mockResolvedValue([]);
  });

  describe('Razorpay webhook signature verification', () => {
    it('accepts a correctly-signed payload', () => {
      const rawBody = JSON.stringify(webhookEvent());
      const validSignature = crypto.createHmac('sha256', 'test-webhook-secret').update(rawBody).digest('hex');
      expect(service.verifyWebhookSignature(rawBody, validSignature)).toBe(true);
    });

    it('rejects a payload with an incorrect signature', () => {
      const rawBody = JSON.stringify(webhookEvent());
      const wrongSignature = crypto.createHmac('sha256', 'wrong-secret').update(rawBody).digest('hex');
      expect(service.verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
    });

    it('rejects a tampered body even with what looks like a plausible signature', () => {
      const originalBody = JSON.stringify(webhookEvent());
      const validSignature = crypto.createHmac('sha256', 'test-webhook-secret').update(originalBody).digest('hex');
      const tamperedBody = JSON.stringify(webhookEvent({ paymentId: 'pay_999_injected' }));
      expect(service.verifyWebhookSignature(tamperedBody, validSignature)).toBe(false);
    });

    it('rejects a signature of the wrong length outright (no timing-unsafe comparison attempted)', () => {
      const rawBody = JSON.stringify(webhookEvent());
      expect(service.verifyWebhookSignature(rawBody, 'too-short')).toBe(false);
    });

    it('throws if RAZORPAY_WEBHOOK_SECRET is not configured, rather than silently accepting anything', async () => {
      jest.resetModules();
      const originalSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const { PaymentService: FreshPaymentService } = await import('./payment.service');
      const freshService = new FreshPaymentService();

      expect(() => freshService.verifyWebhookSignature('{}', 'any-signature')).toThrow(/RAZORPAY_WEBHOOK_SECRET/);

      process.env.RAZORPAY_WEBHOOK_SECRET = originalSecret;
      jest.resetModules();
    });
  });

  describe('handlePaymentCaptured — idempotent subscription creation', () => {
    it('creates a new ACTIVE subscription on first processing of a payment', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null); // not seen before
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, cycleDays: 365 } as any);
      prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' } as any);

      const result = await service.handlePaymentCaptured(webhookEvent());

      expect(result).toEqual({ status: 'created', subscriptionId: 'sub-1' });
      expect(prismaMock.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, planId: PLAN_ID, status: 'ACTIVE', razorpayPaymentId: 'pay_123' }) }),
      );
    });

    it('DUPLICATE webhook handling: the SAME razorpayPaymentId is idempotent — does NOT create a second subscription', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue({ id: 'sub-existing' } as any); // already processed

      const result = await service.handlePaymentCaptured(webhookEvent());

      expect(result).toEqual({ status: 'already_processed', subscriptionId: 'sub-existing' });
      expect(prismaMock.subscription.create).not.toHaveBeenCalled();
      expect(prismaMock.plan.findUniqueOrThrow).not.toHaveBeenCalled(); // short-circuits before even looking up the plan
    });

    it('cycleEnd is set to cycleStart + Plan.cycleDays (Plan/access activation)', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, cycleDays: 30 } as any); // a 30-day pass
      prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' } as any);

      await service.handlePaymentCaptured(webhookEvent());

      const callArgs = prismaMock.subscription.create.mock.calls[0][0] as any;
      const daysDiff = Math.round((callArgs.data.cycleEnd.getTime() - callArgs.data.cycleStart.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(30);
    });

    it('defaults to a 365-day cycle when the Plan has no explicit cycleDays', async () => {
      prismaMock.subscription.findUnique.mockResolvedValue(null);
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, cycleDays: null } as any);
      prismaMock.subscription.create.mockResolvedValue({ id: 'sub-1' } as any);

      await service.handlePaymentCaptured(webhookEvent());

      const callArgs = prismaMock.subscription.create.mock.calls[0][0] as any;
      const daysDiff = Math.round((callArgs.data.cycleEnd.getTime() - callArgs.data.cycleStart.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(365);
    });

    describe('Failed/malformed payment scenarios', () => {
      it('throws on a payload missing the payment entity entirely', async () => {
        await expect(service.handlePaymentCaptured({ payload: {} })).rejects.toThrow(/Malformed webhook payload/i);
        expect(prismaMock.subscription.create).not.toHaveBeenCalled();
      });

      it('throws when notes.userId is missing — never fulfils a payment it cannot attribute to a student', async () => {
        await expect(service.handlePaymentCaptured(webhookEvent({ userId: null }))).rejects.toThrow(/missing userId\/planId/i);
        expect(prismaMock.subscription.create).not.toHaveBeenCalled();
      });

      it('throws when notes.planId is missing', async () => {
        await expect(service.handlePaymentCaptured(webhookEvent({ planId: null }))).rejects.toThrow(/missing userId\/planId/i);
        expect(prismaMock.subscription.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('createOrder', () => {
    const realFetch = global.fetch;
    afterEach(() => {
      global.fetch = realFetch;
    });

    it('throws ProfileIncompleteError before ever contacting Razorpay, when the students profile is incomplete', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({} as any);
      (isProfileComplete as jest.Mock).mockReturnValue(false);
      global.fetch = jest.fn();

      await expect(service.createOrder(USER_ID, PLAN_ID)).rejects.toBeInstanceOf(ProfileIncompleteError);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects ordering the Free plan — there is nothing to pay for', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({} as any);
      (isProfileComplete as jest.Mock).mockReturnValue(true);
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, isFree: true } as any);

      await expect(service.createOrder(USER_ID, PLAN_ID)).rejects.toThrow(/Free plan has no payment/i);
    });

    it('rejects a Plan with no price configured', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({} as any);
      (isProfileComplete as jest.Mock).mockReturnValue(true);
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, isFree: false, launchPrice: null, regularPrice: null, name: 'Test Plan' } as any);

      await expect(service.createOrder(USER_ID, PLAN_ID)).rejects.toThrow(/No price set/i);
    });

    it('rejects an inactive Plan', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({} as any);
      (isProfileComplete as jest.Mock).mockReturnValue(true);
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, isFree: false, launchPrice: 499, regularPrice: 999, active: false, name: 'Test Plan' } as any);

      await expect(service.createOrder(USER_ID, PLAN_ID)).rejects.toThrow(/not currently available/i);
    });

    it('charges launchPrice when set, in preference to regularPrice', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({} as any);
      (isProfileComplete as jest.Mock).mockReturnValue(true);
      prismaMock.plan.findUniqueOrThrow.mockResolvedValue({ id: PLAN_ID, isFree: false, launchPrice: 499, regularPrice: 999, active: true, name: 'Test Plan' } as any);
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'order_1', amount: 49900, currency: 'INR' }) });

      await service.createOrder(USER_ID, PLAN_ID);

      const fetchBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchBody.amount).toBe(49900); // 499 * 100 paise, not 999 * 100
    });
  });
});
