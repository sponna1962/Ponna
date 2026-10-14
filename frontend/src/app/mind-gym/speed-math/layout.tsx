import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Speed Math · Mind Gym | PONNA.in',
  description: 'Speed Math — வேகமாகக் கணக்குப் போடும் இலவசப் பயிற்சி.',
  alternates: { canonical: '/mind-gym/speed-math' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
