'use client';

// Lightweight header for public SEO landing pages (Sept 2026) — these are
// top-of-funnel discovery pages for visitors arriving from search, not
// part of the logged-in app shell, so they use the same simple
// "back to home" pattern as the About page rather than the full
// StudentMenu drawer.

import Image from 'next/image';
import { COLORS } from '../lib/brand-theme';

export function SeoPageHeader() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <Image src="/logo-compact.png" alt="PONNA.in" width={140} height={37} style={{ height: 34, width: 'auto' }} />
      </a>
      <a href="/quiz" style={{ fontSize: 13, fontWeight: 700, color: COLORS.paper, background: COLORS.ink, borderRadius: 999, padding: '8px 16px', textDecoration: 'none' }}>
        Start Practising
      </a>
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
