import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Number Series · Mind Gym | PONNA.in',
  description: 'Number Series — அடுத்த எண்ணைக் கண்டுபிடிக்கும் இலவசப் பயிற்சி.',
  alternates: { canonical: '/mind-gym/number-series' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
