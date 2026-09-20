import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TNPSC Group 4 Question Bank — Subject-wise Practice | PONNA.in',
  description:
    'A subject-wise TNPSC Group 4 question bank covering Indian Polity, General Science, Geography, Indian Economy, Tamil Nadu History, and the Tamil Eligibility Test.',
  alternates: { canonical: '/tnpsc-group-4/question-bank' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
