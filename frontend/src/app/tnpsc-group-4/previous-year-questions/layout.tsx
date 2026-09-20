import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNPSC Group 4 Previous Year Question Papers | PONNA.in',
  description:
    'Practice TNPSC Group 4 previous year question papers, organised subject-wise, with instant answers after every question. Free to start.',
  alternates: { canonical: '/tnpsc-group-4/previous-year-questions' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
