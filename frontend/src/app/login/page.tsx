'use client';

// /login is retired — everything now lives at "/" (finalized requirement:
// no separate login page). Kept only as a redirect for any old bookmarks
// or links.

import { useEffect } from 'react';

export default function LoginRedirect() {
  useEffect(() => {
    window.location.replace('/');
  }, []);
  return null;
}
