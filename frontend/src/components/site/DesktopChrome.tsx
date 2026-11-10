'use client';

// Nov 2026 — on computers every inner page gets the same top bar and full menu
// as the redesigned home page, so the site reads as one site. Phones and
// tablets are untouched: there each page keeps its own header with the ☰
// menu. Shown only from 1261px up (see .pn2-chrome in home-v2.css), and not on
// pages that already render the header themselves, the admin area, or the
// full-screen exam screens.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SiteHeader } from './SiteChrome';
import '../home-v2.css';

const OWN_HEADER = ['/', '/home-preview', '/home-old'];
// /current-affairs and /ask-ponna pin their own header/layout to the top of
// the screen (position: fixed), so a bar above them would be covered.
const SKIP_PREFIX = ['/exams/', '/admin', '/live-exam', '/adaptive-mock', '/test-your-ability', '/shared', '/api', '/current-affairs', '/ask-ponna'];

export function DesktopChrome() {
  const pathname = usePathname() || '/';
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    try { setLoggedIn(!!localStorage.getItem('ponna_student_token')); } catch { /* private mode */ }
  }, [pathname]);

  if (OWN_HEADER.includes(pathname) || SKIP_PREFIX.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="pn2 pn2-chrome">
      <SiteHeader
        account={loggedIn ? <a className="btn btn-line" href="/profile">என் கணக்கு</a> : undefined}
      />
    </div>
  );
}
