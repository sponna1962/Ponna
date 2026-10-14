import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ஞாபக சக்தி பயிற்சி | PONNA.in',
  description: 'எண்களை நினைவில் வைத்து மீண்டும் தட்டச்சு செய்யும் இலவச ஞாபக சக்தி பயிற்சி.',
  alternates: { canonical: '/memory-test' },
};

export default function MemoryTestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
