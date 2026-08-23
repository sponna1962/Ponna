// API base URL — points at wherever the backend is actually hosted.
//
// Locally, leave NEXT_PUBLIC_API_URL unset and this falls back to '' (empty
// string), so calls go to relative paths like `/quiz/start`, and Next.js dev
// server can proxy them if you set up a rewrite. But since Milestone deploys
// now put the backend on its own host (e.g. Railway) separate from the
// frontend (e.g. Vercel), the normal path is: set NEXT_PUBLIC_API_URL in
// Vercel's project settings to the full Railway URL, e.g.
//   NEXT_PUBLIC_API_URL=https://ponna-backend.up.railway.app
// Next.js bakes NEXT_PUBLIC_* variables into the client bundle at build time,
// so this must be set BEFORE deploying, and changing it requires a redeploy.

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function apiUrl(path: string): string {
  // path is expected to start with '/', e.g. '/quiz/start'
  return `${API_BASE_URL}${path}`;
}
