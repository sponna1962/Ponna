'use client';

// Offline-Capable Practice (finalized requirement — world-class polish,
// item 5), SCOPED design: rather than a full offline answer-queue with
// background sync, which would require the answer-submission endpoint to
// be safely retry-idempotent (it currently isn't -- ranking/streak
// updates would double-count a question answered twice, see the
// commit message for the full reasoning), this hook only tracks
// online/offline status. Question CONTENT for the whole session already
// loads upfront (session.service.ts's getSession returns all questions
// at once), so a dropped connection never loses the student's place or
// the questions they can still read -- it just disables NEW answer
// submission until connectivity returns, rather than risking a corrupted
// double-submit once the retry queue's connection comes back.

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
