import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mind Gym | PONNA.in',
  description: 'Mind Gym — நினைவாற்றல், வேகம், சிந்தனைக்கான இலவசப் பயிற்சிகள்.',
  alternates: { canonical: '/mind-gym' },
};

export default function MindGymLayout({ children }: { children: React.ReactNode }) {
  return children;
}
