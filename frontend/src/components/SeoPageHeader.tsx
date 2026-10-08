'use client';

// Lightweight header for public SEO landing pages (Sept 2026) — these are
// top-of-funnel discovery pages for visitors arriving from search, not
// part of the logged-in app shell, so they use the same simple
// "back to home" pattern as the About page rather than the full
// StudentMenu drawer.

import Image from 'next/image';
import { COLORS } from '../lib/brand-theme';
import { StudentMenu } from './StudentMenu';

// Oct 2026 — when a `title` is given, the header matches the student pages
// (☰ menu + page title + small subtitle, like Current Affairs). Without it the
// original logo + "Start Practising" header is kept (used by the TNTET pages).
export function SeoPageHeader({ title, subtitle }: { title?: string; subtitle?: string } = {}) {
  if (title) {
    return (
      <div style={{ background: 'linear-gradient(180deg,var(--color-head1),var(--color-head2))', borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <StudentMenu iconColor="#fff" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: '#FFE9A8' }}>{subtitle}</div>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background: 'linear-gradient(180deg,var(--color-head1),var(--color-head2))', borderBottom: '3px solid #E2B04A' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: '#fefefe', borderRadius: 10, padding: '4px 10px' }}>
          <Image src="/logo-compact.png" alt="PONNA.in" width={140} height={37} style={{ height: 30, width: 'auto' }} />
        </a>
        <a href="/quiz" style={{ fontSize: 13, fontWeight: 800, color: '#2b1c00', background: '#E2B04A', borderRadius: 999, padding: '8px 16px', textDecoration: 'none' }}>
          Start Practising
        </a>
      </div>
    </div>
  );
}

export function Breadcrumb({ items }: { items: { name: string; url: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `https://www.ponna.in${item.url}`,
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" style={{ maxWidth: 720, margin: '0 auto', padding: '14px 20px 0', fontSize: 12.5, color: COLORS.inkMuted }}>
        {items.map((item, i) => (
          <span key={item.url}>
            {i > 0 && <span style={{ margin: '0 6px' }}>›</span>}
            {i === items.length - 1 ? (
              <span>{item.name}</span>
            ) : (
              <a href={item.url} style={{ color: COLORS.inkMuted, textDecoration: 'underline' }}>
                {item.name}
              </a>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
