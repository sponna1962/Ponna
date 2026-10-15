'use client';

// Oct 2026 — shown at the top of every page only when the site is opened
// inside Facebook / Instagram / Messenger etc. (see lib/in-app-browser.ts).
// Android: one button that reopens the same page in Chrome.
// iPhone: apps don't allow that jump, so we show where to tap instead.
// Everywhere else (normal Chrome/Safari) this renders nothing.

import { useEffect, useState } from 'react';
import { detectInAppBrowser, openInChrome, type InAppBrowser } from '../lib/in-app-browser';

export function InAppBrowserBanner() {
  const [iab, setIab] = useState<InAppBrowser | null>(null);

  useEffect(() => {
    setIab(detectInAppBrowser());
  }, []);

  if (!iab) return null;

  return (
    <div
      role="note"
      style={{
        background: '#FFF4D6',
        borderBottom: '1px solid #E8C46A',
        padding: '10px 14px',
        fontSize: 14,
        lineHeight: 1.55,
        color: '#5C3B00',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <p style={{ margin: 0 }}>
          நீங்கள் {iab.app} செயலிக்குள் இருக்கிறீர்கள். எளிதாகப் பதிவு செய்ய
          {iab.os === 'ios' ? ' Safari-இல் ' : ' Chrome-இல் '}
          திறக்கவும்.
        </p>
        {iab.os === 'ios' ? (
          <p style={{ margin: '6px 0 0', fontWeight: 700 }}>
            மேலே உள்ள ⋯ அல்லது ↗ குறியைத் தொட்டு &quot;Open in browser / Safari-இல் திற&quot; என்பதைத் தேர்ந்தெடுக்கவும்.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => openInChrome()}
            style={{
              marginTop: 8,
              width: '100%',
              minHeight: 44,
              borderRadius: 10,
              border: 'none',
              background: '#B7791F',
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Chrome-இல் திறக்கவும்
          </button>
        )}
      </div>
    </div>
  );
}
