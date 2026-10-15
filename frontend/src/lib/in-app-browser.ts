// Oct 2026 — in-app browser handling.
//
// Links tapped inside Facebook / Instagram / Messenger / Threads (and similar
// apps) open in that app's own embedded browser, not in Chrome. Google blocks
// "Sign in with Google" there (error 403: disallowed_useragent — it asks for
// email + password instead and then refuses), so students coming from our
// Meta ads could not sign up at all.
//
// This module detects those embedded browsers so the site can:
//   1. offer a one-tap "open in Chrome" escape (Android), or show how to open
//      the page in the real browser (iPhone), and
//   2. hide the Google sign-in button there, leaving phone OTP (which works
//      inside the embedded browser) as the way in.

export type InAppBrowser = {
  /** Display name of the host app, e.g. "Facebook" */
  app: string;
  os: 'android' | 'ios' | 'other';
};

const RULES: { app: string; test: RegExp }[] = [
  { app: 'Instagram', test: /Instagram/i },
  { app: 'Threads', test: /Barcelona|Threads/i },
  { app: 'Messenger', test: /FB_IAB\/MESSENGER|FBAN\/Messenger|MessengerForiOS|Orca-Android/i },
  { app: 'Facebook', test: /FBAN|FBAV|FB_IAB|FBIOS|FB4A/i },
  { app: 'LinkedIn', test: /LinkedInApp/i },
  { app: 'Snapchat', test: /Snapchat/i },
  { app: 'Telegram', test: /Telegram/i },
  { app: 'Line', test: /\bLine\//i },
];

export function detectInAppBrowser(userAgent?: string): InAppBrowser | null {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return null;
  const rule = RULES.find((r) => r.test.test(ua));
  if (!rule) return null;
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : 'other';
  return { app: rule.app, os };
}

/**
 * Android only: hand the current page to Chrome with an intent:// URL.
 * If Chrome is not installed, Android loads the fallback URL (the same page)
 * so the student is never left on a blank screen.
 */
export function openInChrome(url?: string) {
  if (typeof window === 'undefined') return;
  const target = new URL(url ?? window.location.href);
  const fallback = encodeURIComponent(target.toString());
  const scheme = target.protocol.replace(':', '');
  const intentUrl =
    `intent://${target.host}${target.pathname}${target.search}${target.hash}` +
    `#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  window.location.href = intentUrl;
}
