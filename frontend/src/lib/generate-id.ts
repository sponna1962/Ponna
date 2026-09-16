// Sept 2026 (real bug fix, likely cause of a live "client-side
// exception" crash report) — crypto.randomUUID() requires a reasonably
// recent browser engine (Chrome 92+/2021+); an older or budget Android
// phone's WebView -- exactly the kind of device many TNPSC aspirants
// use -- may not implement it at all, throwing "crypto.randomUUID is
// not a function" the first time a device with no existing
// localStorage id needs one generated (device-id.ts on login,
// test-your-ability's guest diagnostic id) -- a real, uncaught,
// app-crashing TypeError, not a network or API failure. This safe
// fallback tries the native API first (unchanged behavior everywhere
// it's supported) and only falls back to a manually-built UUID-v4-
// shaped string when it's genuinely unavailable, so the fallback string
// still LOOKS like a UUID to anything storing or displaying it.
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
