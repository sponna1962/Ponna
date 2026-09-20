import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help & Support — PONNA.in',
  description:
    'Answers to common questions about PONNA — starting practice, the Free plan, buying a Pass, and account or technical help for TNPSC and TNTET exam preparation.',
  alternates: { canonical: '/help' },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
