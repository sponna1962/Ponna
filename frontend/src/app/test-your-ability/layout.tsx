import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Diagnostic Test for TNPSC & TNTET | PONNA.in',
  description:
    'Take a free, quick diagnostic quiz to see where you stand for TNPSC or TNTET before you start practising. No sign-up needed to try it.',
  alternates: { canonical: '/test-your-ability' },
};

export default function TestYourAbilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
