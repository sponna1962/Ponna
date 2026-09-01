'use client';

// /home is retired — everything now lives at "/" (finalized requirement:
// no separate home page). Kept only as a redirect for any old bookmarks
// or links.

import { useEffect } from 'react';

export default function HomeRedirect() {
  useEffect(() => {
    window.location.replace('/');
  }, []);
  return null;
}
