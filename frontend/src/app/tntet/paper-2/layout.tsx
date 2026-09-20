import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNTET Paper 2 Syllabus & Exam Pattern (Classes 6–8) | PONNA.in',
  description:
    'TNTET Paper 2 syllabus and exam pattern for upper-primary teacher eligibility (Classes 6–8) — Child Development, Language I & II, Mathematics & Science or Social Science. Free practice questions.',
  alternates: { canonical: '/tntet/paper-2' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
