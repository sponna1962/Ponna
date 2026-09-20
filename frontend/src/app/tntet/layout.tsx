import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNTET 2026 — Paper 1 & 2 Syllabus, Exam Pattern & Practice | PONNA.in',
  description:
    'TNTET Paper 1 and Paper 2 syllabus, exam pattern, and marks explained, with free previous-year questions and subject-wise practice for Tamil Nadu Teacher Eligibility Test aspirants.',
  alternates: { canonical: '/tntet' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
