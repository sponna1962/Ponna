import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Code Breaker · Mind Gym | PONNA.in',
  description: 'Code Breaker — குறியீட்டை விடுவிக்கும் இலவசப் பயிற்சி.',
  alternates: { canonical: '/mind-gym/code-breaker' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
