// API base URL for the deployed PONNA backend.
//
// The frontend is hosted on Vercel and the backend is hosted on Render.
// NEXT_PUBLIC_API_URL may still override this for local/staging environments,
// but production must have a concrete backend URL so browser requests do not
// accidentally go to the Vercel frontend origin.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ponna.onrender.com';

export function apiUrl(path: string): string {
  // path is expected to start with '/', e.g. '/quiz/start'
  return `${API_BASE_URL}${path}`;
}
