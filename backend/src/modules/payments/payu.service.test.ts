process.env.PAYU_KEY = 'KEY123';
process.env.PAYU_SALT = 'SALT456';

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});
jest.mock('../practice-preference/milestone.service', () => ({ milestoneService: { checkAndAward: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('./admin-alert.service', () => ({ adminAlertService: { notify: jest.fn() } }));

import { prisma } from '../../lib/prisma';
import { PayuService, requestHash, responseHash, PayuError } from './payu.service';

const db = prisma as unknown as DeepMockProxy<PrismaClient>;
const sha = (t: string) => crypto.createHash('sha512').update(t).digest('hex');
const svc = new PayuService();

function signedCallback(over: Record<string, string> = {}) {
  const p: Record<string, string> = { key: 'KEY123', txnid: 'T1', amount: '499.00', productinfo: 'Pass', firstname: 'Asha', email: 'a@x.in', status: 'success', mihpayid: '999', ...over };
  p.hash = over.hash ?? responseHash(p, 'SALT456');
  return p;
}

beforeEach(() => {
  mockReset(db);
  (db.$transaction as any).mockImplementation(async (fn: any) => fn(db));
});

describe('PayU hashes', () => {
  it('request hash follows key|txnid|amount|productinfo|firstname|email|udf1-5||||||salt', () => {
    const f = { key: 'K', txnid: 'T', amount: '10.00', productinfo: 'P', firstname: 'F', email: 'e@x.in' };
    expect(requestHash(f, 'S')).toBe(sha('K|T|10.00|P|F|e@x.in|||||||||||S'));
  });
  it('response hash is the reverse order and includes additionalCharges when present', () => {
    const p = { key: 'K', txnid: 'T', amount: '10.00', productinfo: 'P', firstname: 'F', email: 'e@x.in', status: 'success' };
    expect(responseHash(p, 'S')).toBe(sha('S|success'+'|'.repeat(11)+'e@x.in|F|P|10.00|T|K'));
    expect(responseHash({ ...p, additionalCharges: '2.00' }, 'S')).toBe(sha('2.00|S|success'+'|'.repeat(11)+'e@x.in|F|P|10.00|T|K'));
  });
});

describe('createCheckout', () => {
  it('refuses the free plan', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ id: 'u', name: 'A', email: null, phone: '9876543210' } as any);
    db.plan.findUniqueOrThrow.mockResolvedValue({ id: 'p', name: 'Free', isFree: true, active: true } as any);
    await expect(svc.createCheckout('u', 'p', 'https://x/cb')).rejects.toBeInstanceOf(PayuError);
  });
  it('signs the form with the plan price and a placeholder email for phone-only students', async () => {
    db.user.findUniqueOrThrow.mockResolvedValue({ id: 'u1', name: 'Asha', email: null, phone: '+91 98765 43210' } as any);
    db.plan.findUniqueOrThrow.mockResolvedValue({ id: 'p', name: 'PONNA Pass', isFree: false, active: true, launchPrice: 399, regularPrice: 599 } as any);
    const out = await svc.createCheckout('u1', 'p', 'https://api/cb');
    expect(out.fields.amount).toBe('399.00');
    expect(out.fields.email).toBe('u1@students.ponna.in');
    expect(out.fields.phone).toBe('9876543210');
    expect(out.fields.hash).toBe(requestHash(out.fields, 'SALT456'));
    expect(db.payuPayment.create).toHaveBeenCalled();
  });
});

describe('handleCallback', () => {
  const pending = { id: 'pp', txnid: 'T1', userId: 'u', planId: 'p', amount: 499, status: 'INITIATED' } as any;
  it('rejects a forged/unsigned callback and creates nothing', async () => {
    const r = await svc.handleCallback(signedCallback({ hash: 'deadbeef' }));
    expect(r.outcome).toBe('invalid');
    expect(db.subscription.create).not.toHaveBeenCalled();
  });
  it('rejects tampering (amount changed after signing)', async () => {
    const good = signedCallback();
    const r = await svc.handleCallback({ ...good, amount: '1.00' });
    expect(r.outcome).toBe('invalid');
  });
  it('creates the subscription once on a verified success', async () => {
    db.payuPayment.findUnique.mockResolvedValue(pending);
    db.plan.findUniqueOrThrow.mockResolvedValue({ id: 'p', name: 'Pass', cycleDays: 365 } as any);
    db.payuPayment.updateMany.mockResolvedValue({ count: 1 });
    db.subscription.create.mockResolvedValue({ id: 's1' } as any);
    const r = await svc.handleCallback(signedCallback());
    expect(r.outcome).toBe('success');
    expect(db.subscription.create).toHaveBeenCalledTimes(1);
  });
  it('does not create a second subscription when the callback is replayed', async () => {
    db.payuPayment.findUnique.mockResolvedValue({ ...pending, status: 'SUCCESS' });
    const r = await svc.handleCallback(signedCallback());
    expect(r.outcome).toBe('success');
    expect(db.subscription.create).not.toHaveBeenCalled();
  });
  it('does not double-create when two callbacks race', async () => {
    db.payuPayment.findUnique.mockResolvedValue(pending);
    db.plan.findUniqueOrThrow.mockResolvedValue({ id: 'p', name: 'Pass', cycleDays: 365 } as any);
    db.payuPayment.updateMany.mockResolvedValue({ count: 0 });
    const r = await svc.handleCallback(signedCallback());
    expect(r.outcome).toBe('success');
    expect(db.subscription.create).not.toHaveBeenCalled();
  });
  it('marks a failed payment as failed and activates nothing', async () => {
    db.payuPayment.findUnique.mockResolvedValue(pending);
    db.payuPayment.updateMany.mockResolvedValue({ count: 1 });
    const r = await svc.handleCallback(signedCallback({ status: 'failure' }));
    expect(r.outcome).toBe('failed');
    expect(db.subscription.create).not.toHaveBeenCalled();
  });
  it('refuses a success whose amount differs from the order', async () => {
    db.payuPayment.findUnique.mockResolvedValue({ ...pending, amount: 599 });
    db.payuPayment.updateMany.mockResolvedValue({ count: 1 });
    const r = await svc.handleCallback(signedCallback());
    expect(r.outcome).toBe('failed');
    expect(db.subscription.create).not.toHaveBeenCalled();
  });
});
