// Unit tests for ScopeAccessService (Sept 2026 — TNPSC Group 4 - VAO Pass
// restriction). Mocked Prisma client — no real database. These tests
// verify the CURRENT business rules as implemented in
// scope-access.service.ts; they do not introduce new behaviour.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { ScopeAccessService, ScopeRestrictedError } from './scope-access.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-1';
const RESTRICTED_SUBCAT = 'group4vao-subcat';
const OTHER_SUBCAT = 'group1-subcat';

function restrictedSub(overrides: Partial<any> = {}) {
  return {
    id: 'sub-restricted',
    userId: USER_ID,
    status: 'ACTIVE',
    cycleEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // 30 days out
    plan: {
      isFree: false,
      restrictToScope: true,
      manualExpiryOverride: null,
      subCategoryScopes: [{ subCategoryId: RESTRICTED_SUBCAT }],
    },
    ...overrides,
  };
}

function unrestrictedSub(overrides: Partial<any> = {}) {
  return {
    id: 'sub-unrestricted',
    userId: USER_ID,
    status: 'ACTIVE',
    cycleEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    plan: {
      isFree: false,
      restrictToScope: false,
      manualExpiryOverride: null,
      subCategoryScopes: [],
    },
    ...overrides,
  };
}

describe('ScopeAccessService', () => {
  let service: ScopeAccessService;

  beforeEach(() => {
    mockReset(prismaMock);
    service = new ScopeAccessService();
    prismaMock.user.findUnique.mockResolvedValue({ isTestAccount: false } as any);
  });

  describe('assertSubCategoryAllowed', () => {
    it('allows a Group 4 - VAO restricted student to access their own scoped Sub-Category', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub()] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, RESTRICTED_SUBCAT)).resolves.toBeUndefined();
    });

    it('denies a Group 4 - VAO restricted student access to a different exam (unauthorized scope access must be denied)', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub()] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).rejects.toBeInstanceOf(ScopeRestrictedError);
    });

    it('allows a broader (unrestricted) TNPSC Pass holder to access ANY Sub-Category', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([unrestrictedSub()] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).resolves.toBeUndefined();
    });

    it('restricted + unrestricted plans held together: the unrestricted plan overrides the restriction', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub(), unrestrictedSub()] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).resolves.toBeUndefined();
    });

    it('Free-only (no paid subscriptions at all) is unrestricted browsing by current design — QuotaService enforces the Free 5/day limit separately, this service only gates SCOPE', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).resolves.toBeUndefined();
    });

    it('an expired restricted subscription (cycleEnd in the past) does not count as active — falls through to Free-only unrestricted browsing', async () => {
      const expired = restrictedSub({ cycleEnd: new Date(Date.now() - 1000 * 60 * 60 * 24) });
      prismaMock.subscription.findMany.mockResolvedValue([expired] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).resolves.toBeUndefined();
    });

    it('a restricted subscription past its manualExpiryOverride date does not count as active', async () => {
      const base = restrictedSub();
      const overridden = { ...base, plan: { ...base.plan, manualExpiryOverride: new Date(Date.now() - 1000) } };
      prismaMock.subscription.findMany.mockResolvedValue([overridden] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).resolves.toBeUndefined();
    });

    it('Test Accounts bypass scope restriction entirely, regardless of plan', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ isTestAccount: true } as any);
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub()] as any);
      await expect(service.assertSubCategoryAllowed(USER_ID, OTHER_SUBCAT)).resolves.toBeUndefined();
      expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
    });
  });

  describe('isRestrictedOnly', () => {
    it('is true when the only active paid plan is restricted', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub()] as any);
      await expect(service.isRestrictedOnly(USER_ID)).resolves.toBe(true);
    });

    it('is false when an unrestricted plan is also active', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub(), unrestrictedSub()] as any);
      await expect(service.isRestrictedOnly(USER_ID)).resolves.toBe(false);
    });

    it('is false for a Free-only student (no paid plan at all — not "restricted", just unpaid)', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([] as any);
      await expect(service.isRestrictedOnly(USER_ID)).resolves.toBe(false);
    });
  });

  describe('getRestrictedSubCategoryIds', () => {
    it('returns the union of scoped Sub-Categories for a restricted-only student', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([restrictedSub()] as any);
      await expect(service.getRestrictedSubCategoryIds(USER_ID)).resolves.toEqual([RESTRICTED_SUBCAT]);
    });

    it('returns an empty list when not restricted-only', async () => {
      prismaMock.subscription.findMany.mockResolvedValue([unrestrictedSub()] as any);
      await expect(service.getRestrictedSubCategoryIds(USER_ID)).resolves.toEqual([]);
    });
  });
});
