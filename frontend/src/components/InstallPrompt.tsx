'use client';

// Install PONNA prompt (Sept 2026, high-priority finalized requirement) —
// global, shown on any page (mounted once in layout.tsx), not something a
// student has to dig for in Help & Support. Uses the REAL PWA install
// capability already set up in this app (manifest.json + next-pwa service
// worker registration, next.config.js) — never a fake/simulated flow.
//
// Three states, decided once on mount:
// - Already installed (standalone display mode / iOS navigator.standalone)
//   -> never shown, permanently.
// - Chrome/Android where the browser actually offers installability (a
//   real `beforeinstallprompt` event fired) -> custom prompt with a
//   working "Install PONNA" button that triggers the BROWSER'S OWN
//   install flow via the captured event — this is not a custom install,
//   it's a styled wrapper around the real one.
// - iOS Safari, which never fires `beforeinstallprompt` at all -> a
//   visual instruction card (Share -> Add to Home Screen -> Add), since
//   no programmatic prompt exists to trigger there.
// If neither condition is met (e.g. desktop browser, or Android but the
// browser hasn't decided the app is installable yet), nothing renders —
// no fallback banner, no nagging.
//
// "Not now" and a completed/declined native install both set a permanent
// localStorage flag — never shown again after that, on this device.

import { useEffect, useState } from 'react';
import { COLORS, DISPLAY_FONT as FONT_FAMILY } from '../lib/brand-theme';

const DISMISS_KEY = 'ponna_install_prompt_dismissed';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [variant, setVariant] = useState<'android' | 'ios' | null>(null);

  useEffect(() => {
    if (isStandalone()) return; // already installed — never show
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) return; // dismissed before — never show again

    if (isIOS()) {
      // Safari never fires beforeinstallprompt — the visual instruction
      // variant is the only correct "install prompt" possible here.
      setVariant('ios');
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVariant('android');
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  function dismiss() {
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1');
    setVariant(null);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // Either outcome (accepted or declined the native dialog) — don't
    // show our own prompt again on this device.
    if (typeof window !== 'undefined') localStorage.setItem(DISMISS_KEY, '1');
    setDeferredPrompt(null);
    setVariant(null);
  }

  if (!variant) return null;

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 70, display: 'flex', justifyContent: 'center', padding: 12, pointerEvents: 'none' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: COLORS.paper,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 16,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.16)',
          padding: 18,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="PONNA" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {variant === 'ios' ? (
              <>
                <p style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>
                  Install PONNA on your iPhone
                </p>
                <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: 0, lineHeight: 1.5 }}>
                  Tap <strong>Share (↑)</strong> → <strong>Add to Home Screen</strong> → <strong>Add</strong>
                </p>
              </>
            ) : (
              <>
                <p style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>Install PONNA</p>
                <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: 0, lineHeight: 1.5 }}>
                  Add PONNA to your Home Screen for quick and easy access.
                </p>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {variant === 'android' && (
            <button
              onClick={install}
              style={{ flex: 1, padding: 12, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              Install PONNA
            </button>
          )}
          <button
            onClick={dismiss}
            style={{
              flex: variant === 'android' ? undefined : 1,
              padding: 12,
              borderRadius: 10,
              background: 'none',
              border: `1px solid ${COLORS.line}`,
              color: COLORS.inkMuted,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
