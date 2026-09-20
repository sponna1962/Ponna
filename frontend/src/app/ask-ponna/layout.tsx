import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ask Ponna — AI Exam Guidance for TNPSC & TNTET | PONNA.in',
  description:
    'Ask PONNA about TNPSC and TNTET exams — eligibility, syllabus, how to prepare, and answers to your specific exam questions. Free AI-powered guidance for Tamil Nadu exam aspirants.',
  alternates: { canonical: '/ask-ponna' },
};

export default function AskPonnaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
