'use client';

// Sept 2026 (real bug fix) — see global-error.tsx's own header comment
// for the full context. This is the Next.js App Router convention for
// catching an uncaught error WITHIN a route (the common case), while
// preserving the root layout (site chrome/fonts/providers stay intact,
// unlike global-error.tsx which replaces the entire HTML shell and only
// fires for errors that escape the root layout itself). Same friendly,
// bilingual retry UI as global-error.tsx.

import { useEffect } from 'react';

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 28,
        textAlign: 'center',
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
  );
}
