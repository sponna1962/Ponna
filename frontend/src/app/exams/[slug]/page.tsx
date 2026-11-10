import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EXAMS, findExam } from '../../../lib/exams';
import ExamPageClient from './ExamPageClient';

export function generateStaticParams() {
  return EXAMS.map((e) => ({ slug: e.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const exam = findExam(params.slug);
  if (!exam) return {};
  const title = `TNPSC ${exam.name} பயிற்சி | PONNA.in`;
  const description = exam.ready
    ? `TNPSC ${exam.name} (${exam.fullName}) தேர்வுக்கான கேள்விப் பயிற்சி, Study Notes, Live Exam, அறிவிப்பு விவரம் — PONNA.in.`
    : `TNPSC ${exam.name} (${exam.fullName}) தேர்வுக்கான பயிற்சி PONNA.in-ல் விரைவில்.`;
  return { title, description, alternates: { canonical: `/exams/${exam.slug}` } };
}

export default function Page({ params }: { params: { slug: string } }) {
  const exam = findExam(params.slug);
  if (!exam) notFound();
  return <ExamPageClient slug={exam.slug} />;
}
