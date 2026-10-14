import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Word Memory · Mind Gym | PONNA.in',
  description: 'Word Memory — வார்த்தைகளை நினைவில் வைக்கும் இலவசப் பயிற்சி.',
  alternates: { canonical: '/mind-gym/word-memory' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
