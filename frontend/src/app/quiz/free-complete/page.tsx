'use client';

import { StudentMenu } from '../../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';

export default function FreePracticeCompletePage() {
  return (
    <main style={{ minHeight: '100dvh', background: COLORS.paper, color: COLORS.ink, paddingBottom: 40 }}>
      <BitterFontLinks />
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: `linear-gradient(180deg, ${COLORS.head1}, ${COLORS.head2})`, borderBottom: '3px solid #E2B04A' }}>
          <StudentMenu iconColor="#fff" />
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>Practice</h1>
        </div>

        <div style={{ padding: '28px 16px 0' }}>
          <section style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 18, padding: '30px 22px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', display: 'grid', placeItems: 'center', background: COLORS.btn, color: COLORS.btnText, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
              ✓
            </div>

            <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 999, background: COLORS.field, border: `1px solid ${COLORS.line}`, color: COLORS.gold, fontSize: 12.5, fontWeight: 700, marginBottom: 14 }}>
              5 / 5 கேள்விகள்
            </div>

            <h2 style={{ fontSize: 22, lineHeight: 1.45, margin: '0 0 8px', color: COLORS.ink, fontWeight: 800 }}>
              இன்றைய இலவச பயிற்சி முடிந்தது
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: COLORS.inkMuted, margin: 0 }}>
              பயிற்சியைத் தொடர பொன்னா பாஸ் பெறுங்கள்.
            </p>

            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${COLORS.line}` }}>
              <div style={{ fontSize: 16, lineHeight: 1.4, color: COLORS.ink, fontWeight: 700 }}>
                Today’s free practice is complete
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: COLORS.inkMuted, margin: '4px 0 0' }}>
                Get Ponna Pass to continue practising.
              </p>
            </div>

            <a
              href="/plans"
              style={{ display: 'block', boxSizing: 'border-box', marginTop: 22, padding: 15, borderRadius: 14, background: COLORS.btn, color: COLORS.btnText, textDecoration: 'none', fontSize: 16, fontWeight: 800, lineHeight: 1.35, boxShadow: '0 10px 24px -10px rgba(15,47,51,.7)' }}
            >
              <span style={{ display: 'block' }}>பொன்னா பாஸ் பெறுங்கள்</span>
              <span style={{ display: 'block', fontSize: 11.5, marginTop: 3, fontWeight: 700, opacity: 0.85 }}>Get Ponna Pass</span>
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
