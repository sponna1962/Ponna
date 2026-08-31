'use client';

// Root index page — public landing page (logged-out visitors). No language
// toggle here (finalized requirement) — the pitch/CTA are shown bilingually
// instead, same pattern as the authenticated Home page. A single "Login"
// link sits top-right; deliberately no separate Sign Up button (login flow
// itself handles both new and returning students).

import { useLanguage } from '../lib/language-context';

export default function IndexPage() {
  const { t } = useLanguage();

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <a
          href="/login"
          style={{
            padding: '8px 18px',
            borderRadius: 20,
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {t.index.login}
        </a>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{t.common.appName}</h1>
        <p style={{ fontSize: 16, color: '#475569', marginBottom: 32 }}>{t.index.pitch}</p>

        <a
          href="/login"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: 14,
            borderRadius: 8,
            background: '#0f172a',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          {t.index.cta}
        </a>
      </div>
    </main>
  );
}
