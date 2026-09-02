// Device ID — a random id generated once per browser/device and persisted
// in localStorage, sent on every login (finalized requirement: 2-device
// cap + single-active-session enforcement). Deliberately NOT a hardware
// fingerprint — just "did this same browser storage log in before."
// Clearing browser storage looks like a new device on next login, same as
// most consumer apps.

const STORAGE_KEY = 'ponna_device_id';

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** A short, human-readable label for the "My Devices" list — not a
 * fingerprint, just enough for a student to recognize which row is which
 * ("this browser" vs "the other one"). */
export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'Android device';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS device';
  if (/windows/i.test(ua)) return 'Windows device';
  if (/macintosh/i.test(ua)) return 'Mac device';
  return 'Browser';
}
