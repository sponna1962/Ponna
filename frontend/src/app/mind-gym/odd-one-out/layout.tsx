import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Odd One Out · Mind Gym | PONNA.in',
  description: 'Odd One Out — வேறுபடுவதைக் கண்டுபிடிக்கும் இலவசப் பயிற்சி.',
  alternates: { canonical: '/mind-gym/odd-one-out' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
