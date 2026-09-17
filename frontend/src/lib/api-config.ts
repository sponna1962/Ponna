// API base URL for the deployed PONNA backend.
//
// Production frontend is on Vercel and production backend is on Render.
// Keep local/staging override support, but never let an old production
// NEXT_PUBLIC_API_URL (for example, the previous Railway host) break the
// deployed frontend after the backend migration.
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || '';
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://ponna.onrender.com'
  : configuredApiUrl;

export function apiUrl(path: string): string {
  // path is expected to start with '/', e.g. '/quiz/start'
  return `${API_BASE_URL}${path}`;
}
