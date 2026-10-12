import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'இலவசப் பயிற்சி | PONNA.in',
  description: 'TNPSC Group 4 இலவசப் பயிற்சி — பதிவு இல்லாமல் 5 கேள்விகள், உடனே விளக்கத்துடன்.',
  alternates: { canonical: '/free-practice' },
};

export default function FreePracticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
