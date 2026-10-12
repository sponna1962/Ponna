import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Notes for TNPSC Group 4 — Subject-wise Summaries | PONNA.in',
  description:
    'Concise, subject-wise study notes for TNPSC Group 4 preparation — General Studies, Aptitude, Tamil, and more, in Tamil and English.',
  alternates: { canonical: '/study-notes' },
};

export default function StudyNotesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
