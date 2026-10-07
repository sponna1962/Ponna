'use client';

// Oct 2026 — anonymous visitor counter (feeds the admin "Visitors" page).
// Sends one tiny request per page view: a random browser id, the page path
// and where the visitor came from. No name, phone or account is attached.
// Never blocks or breaks the page: every failure is swallowed.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiUrl } from '../lib/api-config';

const VID_KEY = 'ponna_vid';
const SESSION_KEY = 'ponna_vsession';

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (!pathname || pathname.startsWith('/admin')) return;
      // The owner's/staff's own browsing is not counted.
      if (localStorage.getItem('ponna_staff_token')) return;

      let visitorId = '';
      let isNew = false;
      try {
        visitorId = localStorage.getItem(VID_KEY) || '';
        if (!visitorId) {
          visitorId = randomId();
          localStorage.setItem(VID_KEY, visitorId);
          isNew = true;
        }
      } catch {
        visitorId = randomId(); // storage blocked: still counts as a visit
      }

      let isEntry = true;
      try {
        if (sessionStorage.getItem(SESSION_KEY)) isEntry = false;
        else sessionStorage.setItem(SESSION_KEY, '1');
      } catch { /* treat as entry */ }

      const q = new URLSearchParams(window.location.search);
      const body = JSON.stringify({
        visitorId,
        path: pathname,
        referrer: isEntry ? document.referrer : '',
        utmSource: isEntry ? q.get('utm_source') || '' : '',
        fbclid: isEntry && !!q.get('fbclid'),
        isNew: isNew && isEntry,
        isEntry,
      });
      void fetch(apiUrl('/track/visit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch { /* tracking must never affect the page */ }
  }, [pathname]);

  return null;
}
