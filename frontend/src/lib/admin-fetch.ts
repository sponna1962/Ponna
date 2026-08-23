// Small helper so every admin page doesn't repeat the Bearer-token boilerplate.
// Redirects to /admin/login on a 401 (expired/missing token).

import { apiUrl } from './api-config';

export async function adminFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ponna_staff_token') : null;

  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('ponna_staff_token');
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  return res;
}
