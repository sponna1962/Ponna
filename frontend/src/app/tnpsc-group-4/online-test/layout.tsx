import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNPSC Group 4 Online Test — Free Mock Test | PONNA.in',
  description:
    'Take a free TNPSC Group 4 online test in real exam conditions — timed, 200 questions across General Studies, Aptitude, and the Tamil Eligibility Test.',
  alternates: { canonical: '/tnpsc-group-4/online-test' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
