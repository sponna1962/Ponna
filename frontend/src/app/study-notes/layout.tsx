import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Notes for TNPSC & TNTET — Subject-wise Summaries | PONNA.in',
  description:
    'Concise, subject-wise study notes for TNPSC and TNTET preparation — General Studies, Aptitude, Tamil, and more, in Tamil and English.',
  alternates: { canonical: '/study-notes' },
};

export default function StudyNotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
