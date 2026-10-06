// Shared layout for the public legal/policy pages (Terms, Refund, Shipping,
// Privacy, Contact). Oct 2026 — added because payment gateways (Instamojo,
// PayU, etc.) require public policy URLs during merchant website review.
// Plain server component, no auth. Oct 2026 redesign: teal header + gold
// accents matching the student pages; all colours are theme tokens so it
// stays readable in Dark Mode.
import { COLORS, DISPLAY_FONT } from '../lib/brand-theme';

export function PolicyPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, minHeight: '100vh', paddingBottom: 48 }}>
      <header style={{ background: 'linear-gradient(180deg, var(--color-head1), var(--color-head2))', borderBottom: '3px solid #E2B04A', color: '#fff', padding: '16px 16px 18px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <a href="/" style={{ display: 'block', fontSize: 13, color: '#FFE9A8', textDecoration: 'none', marginBottom: 6 }}>← PONNA.in</a>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 26, margin: 0, color: '#fff' }}>{title}</h1>
          <p style={{ fontSize: 12, color: '#e5f1f0', margin: '4px 0 0' }}>Last updated: {updated}</p>
        </div>
      </header>
      <article style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 0', lineHeight: 1.7, fontSize: 15 }}>
        <style>{`.policy-body a{color:var(--color-gold);font-weight:600}`}</style>
        <div className="policy-body" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 16, padding: 18 }}>
          {children}
        </div>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: '18px 4px 0', lineHeight: 1.6 }}>
          PONNA.in is a brand of ARLENA (OPC) PRIVATE LIMITED (CIN: U63122TN2026OPC197880).
          Questions? <a href="/contact" style={{ color: COLORS.gold }}>Contact us</a>.
        </p>
      </article>
    </main>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 17, margin: '22px 0 6px', paddingLeft: 10, borderLeft: '4px solid #E2B04A', color: COLORS.ink }}>{children}</h2>;
}
