'use client';

// Welcome Screen (Sept 2026, Item 4 — First-Visit TNPSC Group 4
// Diagnostic Flow). Explicit design brief: this is PONNA's own front
// gateway ("நுழைவாயில்") and must feel genuinely premium and deliberate
// on mobile, never careless. Design grounded in the brand's own
// meaning -- "Ponna" (பொன்ன) is Tamil for gold, and the tagline
// "வெற்றியின் முதல் படி" ("the first step to success") is itself a pun
// on படி meaning both "step" (as in a staircase) and "prepare/study" --
// the ascending-bars motif below is a quiet visual echo of that pun,
// not a generic icon. Full ink-navy ground (rather than the site's
// usual pale paper) gives this one screen its own gravity as a
// threshold moment, with gold doing real work as a beacon rather than
// decoration. Copy itself is locked/approved content from an earlier
// round -- unchanged here, only the visual treatment around it.

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

function AscendingStepsIcon() {
  return (
    <svg width="64" height="40" viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="28" width="12" height="10" rx="2" fill="#D9A94A" fillOpacity="0.55" />
      <rect x="20" y="19" width="12" height="19" rx="2" fill="#D9A94A" fillOpacity="0.75" />
      <rect x="38" y="9" width="12" height="29" rx="2" fill="#D9A94A" />
      <circle cx="56" cy="6" r="4.5" fill="#D9A94A" />
    </svg>
  );
}

export default function TestYourAbilityPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#1A2238',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <BitterFontLinks />

      {/* A quiet, single orchestrated glow behind the headline — the one
          moment of visual richness on this screen, everything else stays
          disciplined around it. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-18%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217,169,74,0.20) 0%, rgba(217,169,74,0) 68%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: 460,
          margin: '0 auto',
          width: '100%',
          padding: '48px 28px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <AscendingStepsIcon />
        </div>

        <h1
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 27,
            fontWeight: 800,
            lineHeight: 1.3,
            color: '#F0EFE9',
            margin: '0 0 14px',
            letterSpacing: '-0.01em',
          }}
        >
          PONNA.in-க்கு வரவேற்கிறோம்!
        </h1>

        <h2
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.45,
            color: '#D9A94A',
            margin: '0 0 22px',
            maxWidth: 380,
          }}
        >
          TNPSC Group 4 தேர்வுக்கு நீங்கள் எவ்வளவு தயாராக இருக்கிறீர்கள்?
        </h2>

        <div style={{ width: 44, height: 2, background: 'rgba(217,169,74,0.4)', marginBottom: 22 }} />

        <p
          style={{
            fontSize: 15.5,
            lineHeight: 1.75,
            color: '#A8ABC0',
            margin: '0 0 40px',
            maxWidth: 340,
          }}
        >
          எங்கள் கேள்விகளுக்கு பதிலளித்து, உங்கள் நிலையைத் தெரிந்துகொள்ளுங்கள்.
        </p>

        <a
          href="/ask-ponna?guestDiagnostic=1"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 320,
            padding: '18px 24px',
            borderRadius: 14,
            background: 'linear-gradient(180deg, #E4BB5F 0%, #D9A94A 100%)',
            color: '#1A2238',
            textDecoration: 'none',
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: '0.01em',
            boxShadow: '0 8px 24px rgba(217,169,74,0.32), 0 2px 6px rgba(0,0,0,0.2)',
          }}
        >
          🎯 தொடங்குங்கள்
        </a>

        {/* "Go to Home" escape hatch (explicit fix — a visitor must never
            feel stuck on this screen with no way out). Deliberately quiet
            relative to the CTA above -- a plain text link, not a second
            button competing for attention. */}
        <a
          href="/?skipWelcome=1"
          style={{
            display: 'inline-block',
            marginTop: 22,
            fontSize: 13.5,
            color: '#6B7290',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          இப்போதைக்கு வேண்டாம், Home-க்கு செல்ல
        </a>
      </div>
    </main>
  );
}
