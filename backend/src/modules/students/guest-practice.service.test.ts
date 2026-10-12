// Unit tests for the signup-free 5-question practice (mocked Prisma).
import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// The sandbox cannot download Prisma's engines, so Prisma.sql is stubbed.
jest.mock('@prisma/client', () => ({ Prisma: { sql: (strings: any, ...values: any[]) => ({ strings, values }) } }));

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { GuestPracticeService, guestPracticeAllowed } from './guest-practice.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('GuestPracticeService', () => {
  const service = new GuestPracticeService();
  beforeEach(() => mockReset(prismaMock));

  it('returns 5 questions and never leaks the answer or explanation', async () => {
    prismaMock.examSubCategory.findFirst.mockResolvedValue({ id: 'sc' } as any);
    prismaMock.subject.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: `s${n}` })) as any,
    );
    let n = 0;
    prismaMock.$queryRaw.mockImplementation((async () => [{ id: `q${++n}` }]) as any);
    prismaMock.question.findMany.mockImplementation((async ({ where }: any) =>
      where.id.in.map((id: string) => ({ id, questionText: 't', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd' }))) as any);

    const out = await service.getQuestions('TA');
    expect(out).toHaveLength(5);
    expect(out.map((q) => q.sequenceNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(JSON.stringify(out)).not.toMatch(/correctOption|explanation/);
    const select = (prismaMock.question.findMany.mock.calls[0][0] as any).select;
    expect(select.correctOption).toBeUndefined();
  });

  it('fails clearly when there are not enough published questions', async () => {
    prismaMock.examSubCategory.findFirst.mockResolvedValue({ id: 'sc' } as any);
    prismaMock.subject.findMany.mockResolvedValue([{ id: 's1' }] as any);
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'q1' }] as any);
    await expect(service.getQuestions('EN')).rejects.toThrow('Not enough published questions');
  });

  it('checks an answer and returns the explanation in the question language', async () => {
    prismaMock.question.findFirst.mockResolvedValue({ correctOption: 'B', language: 'TA', explanationTa: 'விளக்கம்', explanationEn: 'x' } as any);
    expect(await service.checkAnswer('q1', 'B' as any)).toEqual({ isCorrect: true, correctOption: 'B', explanation: 'விளக்கம்' });
    expect((await service.checkAnswer('q1', 'C' as any)).isCorrect).toBe(false);
  });

  it('only checks PUBLISHED questions and rejects bad options', async () => {
    prismaMock.question.findFirst.mockResolvedValue(null);
    await expect(service.checkAnswer('draft', 'A' as any)).rejects.toThrow('Question not found');
    await expect(service.checkAnswer('q1', 'Z' as any)).rejects.toThrow('Invalid option');
    expect((prismaMock.question.findFirst.mock.calls[0][0] as any).where.status).toBe('PUBLISHED');
  });

  it('rate-limits one address', () => {
    const ip = '10.9.9.9';
    let ok = 0;
    for (let i = 0; i < 70; i++) if (guestPracticeAllowed(ip, 'questions')) ok++;
    expect(ok).toBe(60);
  });
});
