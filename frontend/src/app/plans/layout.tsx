import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNPSC & TNTET Annual Plans — Unlimited Practice | PONNA.in',
  description:
    'Get unlimited TNPSC or TNTET practice for a full year with a PONNA Annual Plan. Previous exam questions, expert-designed practice, and instant answers — affordable exam preparation for Tamil Nadu students.',
};

export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
