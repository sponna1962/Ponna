// Unit tests for QuotaService (free/paid daily practice quota). Mocked
// Prisma client — no real database. $transaction is wired to invoke its
// callback with the SAME mocked client (so tx.$queryRaw / tx.user.update
// inside a transaction resolve to the same mocks the test sets up) —
// this mirrors how a real transaction callback receives a client with
// the identical shape, without needing a real DB. These tests verify
// the CURRENT business rules as implemented in quota.service.ts; they do
// not introduce new behaviour.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { QuotaService, AccessSelections } from './quota.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-1';

const NO_SELECTION: AccessSelections = { purposeId: 'purpose-1', allAuthorities: false, authorities: [] };

function activeUnlimitedSub() {
  return {
    id: 'sub-1',
    plan: { purposeId: 'purpose-1', restrictToScope: false, authorityScopes: [], subCategoryScopes: [] },
  };
}

describe('QuotaService', () => {
  let service: QuotaService;

  beforeEach(() => {
    mockReset(prismaMock);
    service = new QuotaService();
    prismaMock.user.findUnique.mockResolvedValue({ isTestAccount: false } as any);
    // Every reserve/get path routes through a transaction — wire it to
    // actually invoke the callback with the same mock client, so the
    // $queryRaw/user.update calls inside are the same ones the tests set up.
    prismaMock.$transaction.mockImplementation(((fn: any) => fn(prismaMock)) as any);
  });

  describe('Free user daily limit', () => {
    it('reports the full 5/day limit when nothing has been used yet today', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any); // no paid plan -> Free path
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({ freePreviewQuestionsUsed: 0 } as any);

      const remaining = await service.getRemainingQuota(USER_ID, NO_SELECTION);
      expect(remaining).toBe(5);
    });

    it('reserveQuota deducts from the Free 5/day quota', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ freePreviewQuestionsUsed: 0 }] as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      const result = await service.reserveQuota(USER_ID, 3, NO_SELECTION);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // 5 - 3
    });

    it('boundary at zero: requesting more than the remaining Free quota is rejected, not partially granted', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      // Already used all 5 today.
      const todayDay = Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ freePreviewQuestionsUsed: todayDay * 10 + 5 }] as any);

      const result = await service.reserveQuota(USER_ID, 1, NO_SELECTION);
      expect(result.allowed).toBe(false);
      expect(result.code).toBe('FREE_PREVIEW_ALREADY_USED');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('a request exactly matching the remaining Free quota is allowed (inclusive boundary)', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ freePreviewQuestionsUsed: 0 }] as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      const result = await service.reserveQuota(USER_ID, 5, NO_SELECTION);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Paid user unlimited (daily-capped) access', () => {
    it('hasUnlimitedAccess is true when an active plan matches the selection Purpose', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([activeUnlimitedSub()] as any);
      await expect(service.hasUnlimitedAccess(USER_ID, NO_SELECTION)).resolves.toBe(true);
    });

    it('a Free-only user (no active paid subscription) does not have unlimited access', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      await expect(service.hasUnlimitedAccess(USER_ID, NO_SELECTION)).resolves.toBe(false);
    });

    it('getRemainingQuota reports the Paid daily limit (75) for a paid, unused-today student', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([activeUnlimitedSub()] as any);
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({ dailyPaidQuestionsUsed: 0, dailyPaidQuestionsDate: null } as any);

      await expect(service.getRemainingQuota(USER_ID, NO_SELECTION)).resolves.toBe(75);
    });

    it('reserveQuota deducts from the Paid 75/day quota', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([activeUnlimitedSub()] as any);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ dailyPaidQuestionsUsed: 0, dailyPaidQuestionsDate: null }] as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      const result = await service.reserveQuota(USER_ID, 20, NO_SELECTION);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(55); // 75 - 20
    });

    it('boundary at zero for Paid: a request exceeding the remaining daily cap is rejected', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([activeUnlimitedSub()] as any);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ dailyPaidQuestionsUsed: 75, dailyPaidQuestionsDate: today }] as any);

      const result = await service.reserveQuota(USER_ID, 1, NO_SELECTION);
      expect(result.allowed).toBe(false);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Test Accounts', () => {
    it('bypass quota entirely — reserveQuota always allows, regardless of usage', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ isTestAccount: true } as any);

      const result = await service.reserveQuota(USER_ID, 999, NO_SELECTION);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999);
      expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Duplicate/idempotent behaviour (current implementation, as-is)', () => {
    it('reserveQuota has NO built-in idempotency key — two sequential calls for the same logical request deduct twice, additively (documents current behaviour, not a recommendation)', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      prismaMock.$queryRaw.mockResolvedValueOnce([{ freePreviewQuestionsUsed: 0 }] as any);
      prismaMock.user.update.mockResolvedValue({} as any);
      const first = await service.reserveQuota(USER_ID, 2, NO_SELECTION);
      expect(first.remaining).toBe(3);

      // A second, independent call sees the previous deduction only if the
      // mock is re-set to reflect it — this test's job is to show the
      // SERVICE does not itself de-duplicate identical calls; the caller
      // (e.g. session.service.ts's own idempotency, if any) is responsible
      // for not calling this twice for one logical action.
      prismaMock.$queryRaw.mockResolvedValueOnce([{ freePreviewQuestionsUsed: (Math.floor(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) / 86400000)) * 10 + 2 }] as any);
      const second = await service.reserveQuota(USER_ID, 2, NO_SELECTION);
      expect(second.remaining).toBe(1); // 5 - 2 - 2, additively deducted again
    });
  });
});
