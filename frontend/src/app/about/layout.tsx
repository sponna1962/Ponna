import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About PONNA — Affordable Exam Practice for Everyone',
  description:
    'PONNA is an online exam practice platform for competitive, employment, entrance, and eligibility examinations. Previous exam questions, expert-designed practice, and instant answers — built to make quality preparation affordable for every student.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
