import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNTET Paper 1 Syllabus & Exam Pattern (Classes 1–5) | PONNA.in',
  description:
    'TNTET Paper 1 syllabus and exam pattern for primary-level teacher eligibility (Classes 1–5) — Child Development, Language I & II, Mathematics, Environmental Studies. Free practice questions.',
  alternates: { canonical: '/tntet/paper-1' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
