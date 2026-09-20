import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Daily Quiz for TNPSC & TNTET — Free Practice Questions | PONNA.in',
  description:
    'A fresh set of TNPSC and TNTET practice questions every day, free. Build a daily practice habit with instant answers and explanations after every question.',
  alternates: { canonical: '/daily-quiz' },
};

export default function DailyQuizLayout({ children }: { children: React.ReactNode }) {
  return children;
}
