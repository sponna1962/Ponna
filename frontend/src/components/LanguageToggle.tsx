'use client';

// Shared toggle button, used identically on every page's top bar.
// One component, one place to change the styling later.

import { useLanguage } from '../lib/language-context';

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  const btnBase: React.CSSProperties = {
    border: 'none',
    background: '#fff',
    color: '#64748b',
    padding: '6px 14px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  };
  const active: React.CSSProperties = { background: '#0f172a', color: '#fff' };

  return (
    <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 20, overflow: 'hidden' }}>
      <button style={{ ...btnBase, ...(lang === 'ta' ? active : {}) }} onClick={() => setLang('ta')}>
        தமிழ்
      </button>
      <button style={{ ...btnBase, ...(lang === 'en' ? active : {}) }} onClick={() => setLang('en')}>
        EN
      </button>
    </div>
  );
}
