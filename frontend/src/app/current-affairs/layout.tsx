import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Current Affairs for TNPSC & TNTET — Daily Updates | PONNA.in',
  description:
    'AI-verified current affairs relevant to TNPSC and TNTET exams, updated daily in Tamil and English. Read the events that actually matter for your exam.',
  alternates: { canonical: '/current-affairs' },
};

export default function CurrentAffairsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
