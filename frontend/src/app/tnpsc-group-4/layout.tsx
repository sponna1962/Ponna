import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNPSC Group 4 2026 — Syllabus, Exam Pattern & Free Practice | PONNA.in',
  description:
    'TNPSC Group 4 exam pattern, syllabus, and marks weightage explained, plus free previous-year questions, an online test, and a subject-wise question bank to practise with.',
  alternates: { canonical: '/tnpsc-group-4' },
};

export default function TnpscGroup4Layout({ children }: { children: React.ReactNode }) {
  return children;
}
