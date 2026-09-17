'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Current Affairs is a student-learning concept, not a separate admin
// question bank. Its generated MCQs are managed and published in Daily Quiz.
export default function CurrentAffairsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/daily-quiz'); }, [router]);
  return <p style={{ padding: 24, color: '#64748b' }}>Opening Daily Quiz — Current Affairs…</p>;
}
