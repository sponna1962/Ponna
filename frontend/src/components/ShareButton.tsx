'use client';

import { useState } from 'react';

// Small "share" button: opens the phone's own share sheet when there is one
// (WhatsApp, Telegram, ...); otherwise a short menu with the common apps and a
// copy-link option. The link always points at the public reading page, so
// anyone who receives it can read without logging in.
export function ShareButton({ title, text, path, label = 'பகிர்க ↗' }: { title: string; text: string; path: string; label?: string }) {
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = () => (typeof window !== 'undefined' ? window.location.origin : 'https://www.ponna.in') + path;
  const enc = encodeURIComponent;

  const onShare = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, text, url: url() });
        return;
      } catch {
        /* cancelled — fall through to the menu */
      }
    }
    setMenu((m) => !m);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const itemStyle: React.CSSProperties = { display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 14, color: 'var(--color-ink)', background: 'transparent', border: 'none', textDecoration: 'none', cursor: 'pointer' };

  return (
    <span className="ponna-noprint" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={onShare}
        aria-haspopup="menu"
        aria-expanded={menu}
        style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-gold)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        {label}
      </button>
      {menu && (
        <div role="menu" onMouseLeave={() => setMenu(false)} style={{ position: 'absolute', left: 0, top: '100%', marginTop: 6, minWidth: 190, zIndex: 60, background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 8, boxShadow: '0 8px 22px rgba(0,0,0,.18)', overflow: 'hidden' }}>
          <a role="menuitem" style={itemStyle} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(text + '\n' + url())}`}>WhatsApp</a>
          <a role="menuitem" style={itemStyle} target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${enc(url())}&text=${enc(text)}`}>Telegram</a>
          <a role="menuitem" style={itemStyle} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url())}`}>Facebook</a>
          <button type="button" role="menuitem" style={itemStyle} onClick={copy}>{copied ? '✓ நகலெடுக்கப்பட்டது' : 'இணைப்பை நகலெடு'}</button>
        </div>
      )}
    </span>
  );
}
