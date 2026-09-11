// Unit tests for offline-practice.service.ts's clampAnsweredAt (Sept
// 2026 — Offline Practice sync date validation / fraud prevention).
// clampAnsweredAt is a private, pure function (no DB access) — called
// here via a cast, which is a plain testing technique and does not
// modify production code. Prisma is still mocked (module-level import)
// so instantiating the service never attempts a real DB connection.
// These tests verify the CURRENT clamping rule as implemented; they do
// not introduce new behaviour.

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { OfflinePracticeService } from './offline-practice.service';

// Access to the private method under test, without changing its
// visibility in production code.
type ClampFn = (claimed: Date, packCreatedAt: Date, syncTime: Date) => Date;
function clamp(service: OfflinePracticeService): ClampFn {
  return (service as any).clampAnsweredAt.bind(service);
}

describe('offline-practice.service — clampAnsweredAt', () => {
  const service = new OfflinePracticeService();
  const clampAnsweredAt = clamp(service);

  const packCreatedAt = new Date('2026-09-01T00:00:00.000Z');
  const syncTime = new Date('2026-09-05T00:00:00.000Z');

  it('accepts a valid claimed time strictly between download and sync, unchanged', () => {
    const claimed = new Date('2026-09-03T12:00:00.000Z');
    expect(clampAnsweredAt(claimed, packCreatedAt, syncTime)).toEqual(claimed);
  });

  it('accepts a claimed time exactly at the download-time boundary, unchanged', () => {
    expect(clampAnsweredAt(new Date(packCreatedAt), packCreatedAt, syncTime)).toEqual(packCreatedAt);
  });

  it('accepts a claimed time exactly at the sync-time boundary, unchanged', () => {
    expect(clampAnsweredAt(new Date(syncTime), packCreatedAt, syncTime)).toEqual(syncTime);
  });

  it('clamps a claimed time BEFORE the pack was even downloaded up to the download time (cannot answer before downloading)', () => {
    const claimed = new Date('2026-08-01T00:00:00.000Z'); // a month before download
    expect(clampAnsweredAt(claimed, packCreatedAt, syncTime)).toEqual(packCreatedAt);
  });

  it('clamps a claimed FUTURE time (past the sync moment) down to the sync time (device-clock-fraud prevention)', () => {
    const claimed = new Date('2026-12-25T00:00:00.000Z'); // months in the future
    expect(clampAnsweredAt(claimed, packCreatedAt, syncTime)).toEqual(syncTime);
  });

  it('an invalid/unparseable timestamp falls back to the sync time rather than propagating NaN', () => {
    const invalid = new Date('not-a-real-date');
    expect(clampAnsweredAt(invalid, packCreatedAt, syncTime)).toEqual(syncTime);
  });

  it('a genuinely long-but-valid offline window (several real days between download and sync) is preserved exactly, not clamped', () => {
    const claimed = new Date('2026-09-03T08:15:00.000Z'); // day 3 of a 5-day-wide window
    expect(clampAnsweredAt(claimed, packCreatedAt, syncTime)).toEqual(claimed);
  });
});
