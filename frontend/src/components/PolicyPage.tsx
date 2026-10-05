// Shared layout for the public legal/policy pages (Terms, Refund, Shipping,
// Privacy, Contact). Oct 2026 — added because payment gateways (Instamojo,
// PayU, etc.) require public policy URLs during merchant website review.
// Plain server component, no auth, matches PONNA's paper/ink look.
import { COLORS, DISPLAY_FONT } from '../lib/brand-theme';

export function PolicyPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, minHeight: '100vh', padding: '24px 16px 64px' }}>
      <article style={{ maxWidth: 680, margin: '0 auto', lineHeight: 1.7, fontSize: 15 }}>
        <a href="/" style={{ fontSize: 13, color: COLORS.inkMuted, textDecoration: 'none' }}>← PONNA.in</a>
        <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 28, margin: '12px 0 4px' }}>{title}</h1>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: '0 0 24px' }}>Last updated: {updated}</p>
        {children}
        <hr style={{ border: 0, borderTop: `1px solid ${COLORS.line}`, margin: '32px 0 12px' }} />
        <p style={{ fontSize: 12, color: COLORS.inkMuted }}>
          PONNA.in is a brand of ARLENA (OPC) PRIVATE LIMITED (CIN: U63122TN2026OPC197880).
          Questions? <a href="/contact">Contact us</a>.
        </p>
      </article>
    </main>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, margin: '24px 0 6px' }}>{children}</h2>;
}
