'use client';

// Route protection for /admin/* — implements the "known gap" flagged in the
// README. The API already rejects unauthenticated calls; this makes that
// visible in the UI by redirecting to /admin/login immediately if no token
// is present, instead of rendering a page that will just fail its fetches.
//
// `skip` must be true on the login page itself — without it, this hook would
// redirect an unauthenticated visitor from /admin/login to /admin/login,
// which is a full-page reload to the same URL and therefore an infinite
// reload loop (this was a real bug, not a hypothetical one).

import { useEffect, useState } from 'react';

export function useRequireStaffAuth(skip: boolean = false) {
  const [checked, setChecked] = useState(skip);

  useEffect(() => {
    if (skip) return;
    const token = localStorage.getItem('ponna_staff_token');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    setChecked(true);
  }, [skip]);

  return checked;
}
