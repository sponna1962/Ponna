'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Current Affairs is a student-learning concept, not a separate admin
 * question bank. Daily current-affairs questions are created and published
 * from the Daily Quiz -> Current Affairs tab. Keep this URL as a redirect so
 * old menu links and bookmarks do not create a second workflow.
 */
export default function CurrentAffairsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/daily-quiz');
  }, [router]);

  return <p style={{ padding: 24, color: '#64748b' }}>Opening Daily Quiz — Current Affairs…</p>;
}
