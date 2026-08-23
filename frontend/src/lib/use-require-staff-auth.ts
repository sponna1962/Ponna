'use client';

// Route protection for /admin/* — implements the "known gap" flagged in the
// README. The API already rejects unauthenticated calls; this makes that
// visible in the UI by redirecting to /admin/login immediately if no token
// is present, instead of rendering a page that will just fail its fetches.

import { useEffect, useState } from 'react';

export function useRequireStaffAuth() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ponna_staff_token');
    if (!token) {
      window.location.href = '/admin/login';
      return;
    }
    setChecked(true);
  }, []);

  return checked;
}
