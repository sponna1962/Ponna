// "Free start" practice for visitors who have NOT signed up (Oct 2026,
// explicit request): 5 real Group 4 questions, instant right/wrong +
// explanation, no phone number, no sign-up. Sign-up is asked only after the
// 5th question.
//
// Deliberately STATELESS (no new table, no migration): the browser keeps its
// own progress. The server only (a) picks 5 published questions without
// revealing the answers and (b) checks one answer at a time. Nothing about
// the visitor is stored.

import { CorrectOption, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class GuestPracticeError extends Error {}

export const GUEST_PRACTICE_QUESTION_COUNT = 5;

// Same official General Studies + Aptitude subjects the guest diagnostic
// samples from (Tamil-paper subjects are left out of this quick taste).
const SUBJECT_NAMES = [
  'General Science',
  'Geography',
  'History, Culture of India, and Indian National Movement',
  'Indian Polity',
  'Indian Economy and Development Administration in Tamil Nadu',
  'History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu',
  'Aptitude',
  'Reasoning',
];

// Simple in-memory per-IP limiter (these endpoints are public). Generous
// enough for many students behind one mobile-network address, tight enough
// that nobody can page through the whole question bank.
const buckets = new Map<string, { n: number; t: number }>();
export function guestPracticeAllowed(ip: string, kind: 'questions' | 'answer'): boolean {
  const limit = kind === 'questions' ? 60 : 400; // per hour
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.t > 3_600_000) {
    buckets.set(key, { n: 1, t: now });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.t > 3_600_000) buckets.delete(k);
    return true;
  }
  b.n += 1;
  return b.n <= limit;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GuestPracticeService {
  /** 5 questions, one from each of 5 randomly chosen subjects, in the chosen
   * language. Never includes the correct option or the explanation. */
  async getQuestions(language: 'TA' | 'EN') {
    const subCategory = await prisma.examSubCategory.findFirst({ where: { studentVisible: true }, select: { id: true } });
    if (!subCategory) throw new GuestPracticeError('No exam is currently available.');

    const subjects = await prisma.subject.findMany({
      where: { subCategoryId: subCategory.id, name: { in: SUBJECT_NAMES } },
      select: { id: true },
    });
    const chosen = shuffle(subjects).slice(0, GUEST_PRACTICE_QUESTION_COUNT);

    const ids: string[] = [];
    for (const { id: subjectId } of chosen) {
      const picked = await prisma.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          SELECT id FROM "Question"
          WHERE status = 'PUBLISHED'
            AND language = ${language}::"Language"
            AND "subjectId" = ${subjectId}
            AND NOT EXISTS (
              SELECT 1 FROM "QuestionAuditFlag" f WHERE f."questionId" = "Question".id AND f.status != 'DISMISSED'
            )
          ORDER BY ("sourceType" = 'ORIGINAL') DESC, random()
          LIMIT 1
        `,
      );
      if (picked[0]) ids.push(picked[0].id);
    }
    if (ids.length < GUEST_PRACTICE_QUESTION_COUNT) {
      throw new GuestPracticeError('Not enough published questions are available yet.');
    }

    const rows = await prisma.question.findMany({
      where: { id: { in: ids } },
      select: { id: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true },
    });
    return shuffle(rows).map((q, i) => ({ sequenceNumber: i + 1, ...q }));
  }

  /** Checks ONE answer and returns the right option with its explanation. */
  async checkAnswer(questionId: string, selectedOption: CorrectOption) {
    if (!['A', 'B', 'C', 'D'].includes(selectedOption)) throw new GuestPracticeError('Invalid option.');
    const q = await prisma.question.findFirst({
      where: { id: questionId, status: 'PUBLISHED' },
      select: { correctOption: true, language: true, explanationTa: true, explanationEn: true },
    });
    if (!q) throw new GuestPracticeError('Question not found.');
    return {
      isCorrect: q.correctOption === selectedOption,
      correctOption: q.correctOption,
      explanation: (q.language === 'TA' ? q.explanationTa : q.explanationEn) ?? null,
    };
  }
}

export const guestPracticeService = new GuestPracticeService();
