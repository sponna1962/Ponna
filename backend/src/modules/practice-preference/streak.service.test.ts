// Unit tests for streak.service.ts (Sept 2026 — Offline Practice streak
// backfill). Mocked Prisma client, stateful (a local fake "User row" that
// findUniqueOrThrow/update read and write) since backfillStreakForDates
// re-reads the user between every date it processes — a plain sequence
// of mockResolvedValueOnce calls would be fragile and wouldn't actually
// verify the real read-after-write behaviour. These tests verify the
// CURRENT business rules as implemented; they do not introduce new
// behaviour.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { backfillStreakForDates, recordStreakActivity, getStreakDisplay } from './streak.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER_ID = 'user-1';

interface FakeUserRow {
  currentStreak: number;
  longestStreak: number;
  lastStreakDate: Date | null;
}

/** Wires the mocked findUniqueOrThrow/update to a real, mutable local
 * object — every read reflects the latest write, exactly like a real DB
 * row would across the sequential calls backfillStreakForDates makes. */
function wireFakeUserRow(initial: FakeUserRow): { get: () => FakeUserRow } {
  let row: FakeUserRow = { ...initial };

  prismaMock.user.findUniqueOrThrow.mockImplementation(async () => ({ ...row } as any));
  prismaMock.user.update.mockImplementation(async ({ data }: any) => {
    row = {
      currentStreak: data.currentStreak ?? row.currentStreak,
      longestStreak: data.longestStreak ?? row.longestStreak,
      lastStreakDate: data.lastStreakDate ?? row.lastStreakDate,
    };
    return row as any;
  });

  return { get: () => row };
}

function day(offsetFromEpochDays: number): Date {
  // Fixed, deterministic dates (not "today") so tests never depend on
  // the actual current date/time.
  return new Date(Date.UTC(2026, 8, offsetFromEpochDays)); // September 2026
}

describe('streak.service', () => {
  beforeEach(() => {
    mockReset(prismaMock);
  });

  describe('backfillStreakForDates', () => {
    it('extends the streak by the true number of consecutive offline days, not just by 1', async () => {
      const fake = wireFakeUserRow({ currentStreak: 0, longestStreak: 0, lastStreakDate: null });

      await backfillStreakForDates(USER_ID, [day(1), day(2), day(3)]);

      expect(fake.get().currentStreak).toBe(3);
      expect(fake.get().longestStreak).toBe(3);
      expect(fake.get().lastStreakDate).toEqual(day(3));
    });

    it('processes out-of-order input dates in chronological order regardless of array order', async () => {
      const fake = wireFakeUserRow({ currentStreak: 0, longestStreak: 0, lastStreakDate: null });

      await backfillStreakForDates(USER_ID, [day(3), day(1), day(2)]);

      expect(fake.get().currentStreak).toBe(3);
    });

    it('collapses duplicate dates in the input into a single day (no double-counting)', async () => {
      const fake = wireFakeUserRow({ currentStreak: 1, longestStreak: 1, lastStreakDate: day(1) });

      await backfillStreakForDates(USER_ID, [day(2), day(2), day(2)]);

      // day(2) is consecutive after day(1) -> streak becomes 2, and stays
      // 2 even though day(2) appears three times in the input.
      expect(fake.get().currentStreak).toBe(2);
    });

    it('a gap (non-consecutive offline days) restarts the streak at 1 for the day after the gap', async () => {
      const fake = wireFakeUserRow({ currentStreak: 0, longestStreak: 0, lastStreakDate: null });

      // day(1) then day(5) -- a 3-day gap in between.
      await backfillStreakForDates(USER_ID, [day(1), day(5)]);

      expect(fake.get().currentStreak).toBe(1);
      expect(fake.get().lastStreakDate).toEqual(day(5));
    });

    it('never moves an already-advanced streak backward: an offline date at or before the existing lastStreakDate is skipped entirely (existing streak preserved)', async () => {
      const fake = wireFakeUserRow({ currentStreak: 5, longestStreak: 5, lastStreakDate: day(10) });

      // Sync arrives late with an OLDER offline date (e.g. online activity
      // already happened more recently than this offline pack).
      await backfillStreakForDates(USER_ID, [day(3)]);

      expect(fake.get().currentStreak).toBe(5); // unchanged
      expect(fake.get().lastStreakDate).toEqual(day(10)); // unchanged
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('longestStreak is preserved (never decreases) even when currentStreak restarts after a gap', async () => {
      const fake = wireFakeUserRow({ currentStreak: 10, longestStreak: 10, lastStreakDate: day(1) });

      // A big gap -- currentStreak restarts at 1, but longestStreak (10)
      // must never be reduced.
      await backfillStreakForDates(USER_ID, [day(20)]);

      expect(fake.get().currentStreak).toBe(1);
      expect(fake.get().longestStreak).toBe(10);
    });

    it('a mix of some dates before and some after lastStreakDate only advances using the valid (after) ones', async () => {
      const fake = wireFakeUserRow({ currentStreak: 2, longestStreak: 2, lastStreakDate: day(5) });

      await backfillStreakForDates(USER_ID, [day(2), day(3), day(6), day(7)]);

      // day(2)/day(3) are <= lastStreakDate(5) -> skipped.
      // day(6) is consecutive after day(5) -> streak 3.
      // day(7) is consecutive after day(6) -> streak 4.
      expect(fake.get().currentStreak).toBe(4);
      expect(fake.get().lastStreakDate).toEqual(day(7));
    });

    it('an empty dates array is a no-op', async () => {
      const fake = wireFakeUserRow({ currentStreak: 5, longestStreak: 5, lastStreakDate: day(1) });

      await backfillStreakForDates(USER_ID, []);

      expect(fake.get().currentStreak).toBe(5);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe('recordStreakActivity (real-time path, backward-compatibility check)', () => {
    it('first-ever activity starts the streak at 1', async () => {
      wireFakeUserRow({ currentStreak: 0, longestStreak: 0, lastStreakDate: null });
      await recordStreakActivity(USER_ID);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentStreak: 1 }) }),
      );
    });
  });

  describe('getStreakDisplay (read-only, unaffected by backfill changes)', () => {
    it('returns 0 when more than a day has been missed, without writing anything', async () => {
      prismaMock.user.findUniqueOrThrow.mockResolvedValue({
        currentStreak: 7,
        longestStreak: 7,
        lastStreakDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 real days ago
      } as any);

      const result = await getStreakDisplay(USER_ID);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(7);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});
