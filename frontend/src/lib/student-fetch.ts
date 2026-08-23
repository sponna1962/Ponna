// Student equivalent of admin-fetch.ts — attaches the student session JWT
// (issued by our backend after Firebase verification, see student-auth.service.ts)
// to every API call, and redirects to /login on a 401.

import { apiUrl } from './api-config';

export async function studentFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ponna_student_token') : null;

  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('ponna_student_token');
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  return res;
}
