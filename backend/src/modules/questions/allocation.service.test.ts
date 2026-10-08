// Unit tests for AllocationService.buildSessionQuestionIds (Question
// Allocation Engine, balanced/random version — Oct 2026). Prisma is mocked
// with a tiny in-memory question bank and a matcher that understands just the
// where-clauses the engine builds (AND/OR, subjectId in, difficulty in,
// id notIn). No real database.

import { mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

jest.mock('../../lib/prisma', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { prisma: mockDeep() };
});

import { prisma } from '../../lib/prisma';
import { AllocationService } from './allocation.service';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const USER = 'user-1';
const TAXONOMY = { authorityId: 'tnpsc' };

type Q = { id: string; subjectId: string; sourceType: string; difficulty: string };
let bank: Q[] = [];

function matches(where: any, q: Q): boolean {
  if (!where || typeof where !== 'object') return true;
  if (Array.isArray(where)) return where.every((w) => matches(w, q));
  for (const [key, val] of Object.entries<any>(where)) {
    if (key === 'AND') { if (!val.every((w: any) => matches(w, q))) return false; continue; }
    if (key === 'OR') { if (!val.some((w: any) => matches(w, q))) return false; continue; }
    if (key === 'subjectId') { if (val?.in && !val.in.includes(q.subjectId)) return false; continue; }
    if (key === 'difficulty') { if (val?.in && !val.in.includes(q.difficulty)) return false; continue; }
    if (key === 'id') { if (val?.notIn && val.notIn.includes(q.id)) return false; continue; }
    if (key === 'syllabusTopic') return false; // nothing in the bank is topic-tagged
    // status / language / history / auditFlags / authorityId: always satisfied here
  }
  return true;
}

function fill(prefix: string, subjectId: string, n: number, sourceType = 'BOOK', difficulty = 'MEDIUM'): Q[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, subjectId, sourceType, difficulty }));
}

// Group IV-like syllabus: Tamil 8, Aptitude 2 (two flat subjects), six GS x1.
const SYLLABUS = [
  { id: 'syl-tamil', name: 'Tamil', linkedSubjectIds: ['f-tamil'], practiceWeight: 8 },
  { id: 'syl-apt', name: 'Aptitude', linkedSubjectIds: ['f-apt', 'f-reason'], practiceWeight: 2 },
  { id: 'syl-sci', name: 'Science', linkedSubjectIds: ['f-sci'], practiceWeight: null },
  { id: 'syl-geo', name: 'Geography', linkedSubjectIds: ['f-geo'], practiceWeight: null },
  { id: 'syl-pol', name: 'Polity', linkedSubjectIds: ['f-pol'], practiceWeight: null },
  { id: 'syl-eco', name: 'Economy', linkedSubjectIds: ['f-eco'], practiceWeight: null },
  { id: 'syl-his', name: 'History India', linkedSubjectIds: ['f-his'], practiceWeight: null },
  { id: 'syl-tn', name: 'History TN', linkedSubjectIds: ['f-tn'], practiceWeight: null },
];
const FLAT_TO_BUCKET: Record<string, string> = {
  'f-tamil': 'Tamil', 'f-apt': 'Aptitude', 'f-reason': 'Aptitude', 'f-sci': 'GS', 'f-geo': 'GS', 'f-pol': 'GS',
  'f-eco': 'GS', 'f-his': 'GS', 'f-tn': 'GS',
};

function fullBank(): Q[] {
  return [
    ...fill('tamil-', 'f-tamil', 2600),
    ...fill('apt-', 'f-apt', 900), ...fill('rea-', 'f-reason', 50),
    ...fill('sci-', 'f-sci', 3900), ...fill('geo-', 'f-geo', 2400), ...fill('pol-', 'f-pol', 1500),
    ...fill('eco-', 'f-eco', 900), ...fill('his-', 'f-his', 450), ...fill('tn-', 'f-tn', 640),
  ];
}

function countBySubject(ids: string[]) {
  const bySubject: Record<string, number> = {};
  const byId = new Map(bank.map((q) => [q.id, q]));
  for (const id of ids) {
    const s = byId.get(id)!.subjectId;
    bySubject[s] = (bySubject[s] ?? 0) + 1;
  }
  return bySubject;
}

describe('AllocationService.buildSessionQuestionIds (balanced engine)', () => {
  let service: AllocationService;
  let lastWheres: any[];

  beforeEach(() => {
    mockReset(prismaMock);
    service = new AllocationService();
    lastWheres = [];
    prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue({
      caRecencyWindowDays: 90, caMaxFor5Q: 0, caMaxFor20Q: 0, caMaxFor50Q: 0,
    } as any);
    (prismaMock.syllabusSubject.findMany as jest.Mock).mockImplementation(async (args: any) => {
      const ids = args?.where?.id?.in;
      return ids ? SYLLABUS.filter((s) => ids.includes(s.id)) : SYLLABUS;
    });
    (prismaMock.question.findMany as jest.Mock).mockImplementation(async (args: any) => {
      lastWheres.push(args.where);
      return bank.filter((q) => matches(args.where, q)).map((q) => ({ id: q.id, sourceType: q.sourceType }));
    });
    bank = fullBank();
  });

  it('no preference: a 75-question session follows the Group IV paper (Tamil half, Aptitude an eighth, rest GS)', async () => {
    const ids = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 75, 'TA' as any, TAXONOMY, null, 'sub-g4');
    expect(ids).toHaveLength(75);
    expect(new Set(ids).size).toBe(75);
    const bySubject = countBySubject(ids);
    expect(bySubject['f-tamil']).toBeGreaterThanOrEqual(37);
    expect(bySubject['f-tamil']).toBeLessThanOrEqual(38);
    const apt = (bySubject['f-apt'] ?? 0) + (bySubject['f-reason'] ?? 0);
    expect(apt).toBeGreaterThanOrEqual(9);
    expect(apt).toBeLessThanOrEqual(10);
    for (const s of ['f-sci', 'f-geo', 'f-pol', 'f-eco', 'f-his', 'f-tn']) {
      expect(bySubject[s]).toBeGreaterThanOrEqual(4);
      expect(bySubject[s]).toBeLessThanOrEqual(5);
    }
  });

  it('is not oldest-first: repeated sessions differ and are not the first uploaded questions', async () => {
    const a = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 75, 'TA' as any, TAXONOMY, null, 'sub-g4');
    const b = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 75, 'TA' as any, TAXONOMY, null, 'sub-g4');
    expect(a.join()).not.toBe(b.join());
    const firstUploaded = new Set(bank.slice(0, 75).map((q) => q.id));
    expect(a.filter((id) => firstUploaded.has(id)).length).toBeLessThan(75);
  });

  it('a short subject never makes the session short — the others cover it', async () => {
    bank = [...fill('tamil-', 'f-tamil', 2600), ...fill('his-', 'f-his', 2), ...fill('sci-', 'f-sci', 500), ...fill('geo-', 'f-geo', 500)];
    const ids = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 75, 'TA' as any, TAXONOMY, null, 'sub-g4');
    expect(ids).toHaveLength(75);
    expect(countBySubject(ids)['f-his']).toBe(2);
  });

  it('returns only what exists when the whole pool is smaller than the session', async () => {
    bank = fill('only-', 'f-sci', 10);
    const ids = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 75, 'TA' as any, TAXONOMY, null, 'sub-g4');
    expect(ids).toHaveLength(10);
  });

  it('subject preference is a hard boundary and chosen subjects share equally', async () => {
    const ids = await service.buildSessionQuestionIds(
      USER, 'MIXED' as any, 40, 'TA' as any, TAXONOMY, { subjectIds: ['syl-pol', 'syl-eco'], topicIds: [] }, 'sub-g4',
    );
    expect(ids).toHaveLength(40);
    const bySubject = countBySubject(ids);
    expect(Object.keys(bySubject).sort()).toEqual(['f-eco', 'f-pol']);
    expect(bySubject['f-pol']).toBe(20);
    expect(bySubject['f-eco']).toBe(20);
  });

  it('a single chosen subject stays inside that subject even when it is smaller than the session', async () => {
    const ids = await service.buildSessionQuestionIds(
      USER, 'MIXED' as any, 600, 'TA' as any, TAXONOMY, { subjectIds: ['syl-his'], topicIds: [] }, 'sub-g4',
    );
    expect(ids).toHaveLength(450); // all there is — never topped up from another subject
    expect(Object.keys(countBySubject(ids))).toEqual(['f-his']);
  });

  it('keeps the exam taxonomy filter alongside the subject preference (it used to be overwritten)', async () => {
    await service.buildSessionQuestionIds(
      USER, 'MIXED' as any, 10, 'TA' as any, TAXONOMY, { subjectIds: ['syl-pol'], topicIds: [] }, 'sub-g4',
    );
    expect(lastWheres.length).toBeGreaterThan(0);
    for (const w of lastWheres) expect(JSON.stringify(w)).toContain('"authorityId":"tnpsc"');
  });

  it('excludes questions the student already answered (history filter on every query)', async () => {
    await service.buildSessionQuestionIds(USER, 'MIXED' as any, 10, 'TA' as any, TAXONOMY, null, 'sub-g4');
    for (const w of lastWheres) expect(JSON.stringify(w)).toContain(`"history":{"none":{"userId":"${USER}"}}`);
  });

  it('mixes real previous-exam questions (30%) with book questions inside a subject', async () => {
    bank = [...fill('p-', 'f-sci', 300, 'PREVIOUS_EXAM'), ...fill('b-', 'f-sci', 300, 'BOOK')];
    prismaMock.syllabusSubject.findMany.mockResolvedValue([SYLLABUS[2]] as any);
    const ids = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 50, 'TA' as any, TAXONOMY, null, 'sub-g4');
    const prev = ids.filter((id) => id.startsWith('p-')).length;
    expect(ids).toHaveLength(50);
    expect(prev).toBe(15);
  });

  it('only the broadened-difficulty pass can reach other difficulties, and only inside the subject', async () => {
    bank = [...fill('m-', 'f-pol', 5, 'BOOK', 'MEDIUM'), ...fill('h-', 'f-pol', 20, 'BOOK', 'HARD'), ...fill('x-', 'f-eco', 50)];
    const ids = await service.buildSessionQuestionIds(
      USER, 'MEDIUM' as any, 15, 'TA' as any, TAXONOMY, { subjectIds: ['syl-pol'], topicIds: [] }, 'sub-g4',
    );
    expect(ids).toHaveLength(15);
    expect(ids.filter((id) => id.startsWith('m-'))).toHaveLength(5);
    expect(ids.filter((id) => id.startsWith('x-'))).toHaveLength(0);
  });

  it('no sub-category known: one open random draw from the whole eligible pool', async () => {
    const ids = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 30, 'TA' as any, TAXONOMY, null, null);
    expect(ids).toHaveLength(30);
    expect(prismaMock.syllabusSubject.findMany).not.toHaveBeenCalled();
  });

  it('Current Affairs stays capped and is included', async () => {
    prismaMock.platformSettings.findUniqueOrThrow.mockResolvedValue({
      caRecencyWindowDays: 90, caMaxFor5Q: 1, caMaxFor20Q: 3, caMaxFor50Q: 5,
    } as any);
    const ca = [{ id: 'ca-1' }, { id: 'ca-2' }, { id: 'ca-3' }];
    (prismaMock.question.findMany as jest.Mock).mockImplementation(async (args: any) => {
      const text = JSON.stringify(args.where);
      if (text.includes('CURRENT_AFFAIRS')) return ca;
      return bank.filter((q) => matches(args.where, q)).map((q) => ({ id: q.id, sourceType: q.sourceType }));
    });
    const ids = await service.buildSessionQuestionIds(USER, 'MIXED' as any, 20, 'TA' as any, TAXONOMY, null, 'sub-g4');
    expect(ids).toHaveLength(20);
    expect(ids.filter((id) => id.startsWith('ca-'))).toHaveLength(3);
  });
});
