'use client';

// Sept 2026 (real bug fix) — a live crash report ("Application error:
// a client-side exception has occurred") showed the raw, unhelpful
// Next.js default error screen with no way forward except manually
// closing and reopening the app. This is a Next.js App Router
// convention: any uncaught rendering error anywhere in the app now
// renders this instead -- a friendly, bilingual retry screen with a
// working "Reload" button, so a student hitting an unexpected bug can
// at least recover without knowing to force-close the app themselves.
// This does NOT fix the underlying bug that caused the crash (each
// such bug still needs its own real fix when found) -- it only makes
// recovering from ANY crash, known or not-yet-found, far less
// confusing for the student.

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <html lang="ta">
      <body>
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 28,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            background: '#FAFAF7',
            color: '#1A2238',
          }}
        >
          <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
          <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>ஏதோ தவறு நடந்துவிட்டது</p>
          <p style={{ fontSize: 13, color: '#5B6178', marginBottom: 24, maxWidth: 320 }}>
            Something went wrong. மீண்டும் முயற்சிக்கவும் / Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '12px 28px',
              borderRadius: 10,
              background: '#1A2238',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: 12,
            }}
          >
            🔄 மீண்டும் முயற்சிக்கவும் / Retry
          </button>
          <a href="/" style={{ fontSize: 13, color: '#2851A3', textDecoration: 'underline' }}>
            Home-க்கு செல்ல
          </a>
        </main>
      </body>
    </html>
  );
}
