'use client';

// Root index page — implements §4.5 language toggle via shared context.

import { useLanguage } from '../lib/language-context';
import { LanguageToggle } from '../components/LanguageToggle';

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
        <LanguageToggle />
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
            marginBottom: 12,
            textDecoration: 'none',
          }}
        >
          {t.index.cta}
        </a>

        <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>{t.index.note}</p>
      </div>
    </main>
  );
}
