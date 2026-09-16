'use client';

// Welcome Screen (Sept 2026, Item 4 — First-Visit TNPSC Group 4
// Diagnostic Flow). A beautiful, premium, single-CTA entry point for
// brand-new visitors — no signup needed. Tapping the CTA hands off to
// the Ask Ponna page's own guest-diagnostic mode (see
// ask-ponna/page.tsx's own header comment), which asks for a language,
// then immediately runs 15 questions one at a time inside the SAME
// chat UI students already know from Ask Ponna, rather than a separate
// custom quiz page.

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

export default function TestYourAbilityPage() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 28,
        background: `linear-gradient(180deg, ${COLORS.goldLight} 0%, ${COLORS.paper} 55%)`,
        color: COLORS.ink,
        textAlign: 'center',
      }}
    >
      <BitterFontLinks />
      <div style={{ fontSize: 44, marginBottom: 18 }}>🎯</div>
      <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, lineHeight: 1.35, marginBottom: 10 }}>PONNA.in-க்கு வரவேற்கிறோம்!</h1>
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, lineHeight: 1.4, color: COLORS.gold, marginBottom: 20 }}>
        TNPSC Group 4 தேர்வுக்கு நீங்கள் எவ்வளவு தயாராக இருக்கிறீர்கள்?
      </h2>
      <p style={{ fontSize: 14.5, color: COLORS.inkMuted, lineHeight: 1.6, marginBottom: 32, maxWidth: 360 }}>
        எங்கள் கேள்விகளுக்கு பதிலளித்து, உங்கள் நிலையைத் தெரிந்துகொள்ளுங்கள்.
      </p>
      <a
        href="/ask-ponna?guestDiagnostic=1"
        style={{
          display: 'block',
          width: '100%',
          maxWidth: 340,
          padding: '17px 24px',
          borderRadius: 14,
          background: COLORS.ink,
          color: COLORS.paper,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 16,
          boxShadow: '0 4px 14px rgba(26,34,56,0.25)',
        }}
      >
        🎯 தொடங்குங்கள்
      </a>
    </main>
  );
}
