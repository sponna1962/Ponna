// "Return after login" — when a logged-out visitor decides to pay (or opens
// the Plans page), remember where they were going. After they sign in the
// home page sends them straight back, and the Trial page resumes the PayU
// checkout by itself, so nobody has to find the pay button a second time.
const KEY = 'ponna_after_login';
const MAX_AGE_MS = 30 * 60 * 1000;

export function rememberAfterLogin(url: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ url, at: Date.now() })); } catch {}
}

/** Returns the saved URL once (and clears it) if it is fresh and on-site. */
export function takeAfterLogin(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return null;
    const { url, at } = JSON.parse(raw);
    if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return null;
    if (Date.now() - Number(at) > MAX_AGE_MS) return null;
    return url;
  } catch { return null; }
}
