'use client';

// Welcome Screen (Sept 2026, Item 4 — First-Visit TNPSC Group 4
// Diagnostic Flow). Refined per explicit follow-up feedback: keep the
// existing dark-navy/gold/premium direction, but read less like a
// generic AI-product landing page and more like a trusted government
// competitive-exam platform -- no emoji on the CTA, no generic bar-
// chart-style icon (no PONNA logo asset exists yet, so the top area
// stays simple: the plain wordmark, matching how it reads everywhere
// else on the site), and the gold glow toned down so it reads as a
// quiet accent rather than a decorative effect. Copy is locked/
// approved content from this same feedback round -- unchanged from
// here on without a further explicit request.

import { DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

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

      {/* A single, quiet glow behind the headline -- toned down
          (explicit feedback) from the previous pass so it reads as a
          subtle accent, not a decorative effect. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '-22%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 440,
          height: 440,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217,169,74,0.10) 0%, rgba(217,169,74,0) 70%)',
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
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 15,
            fontWeight: 700,
            color: '#D9A94A',
            letterSpacing: '0.02em',
            margin: '0 0 32px',
          }}
        >
          PONNA.in
        </p>

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
          அரசுப் போட்டித் தேர்வுக்கு நீங்கள் எவ்வளவு தயாராக இருக்கிறீர்கள்?
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
          எங்கள் கேள்விகளுக்கு பதிலளித்து, உங்கள் தயார்நிலையைத் தெரிந்துகொள்ளுங்கள்.
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
            boxShadow: '0 6px 16px rgba(217,169,74,0.22)',
          }}
        >
          தொடங்குங்கள் →
        </a>

        {/* "Go to Home" escape hatch — a visitor must never feel stuck on
            this screen with no way out. Deliberately quiet relative to
            the CTA above -- a plain text link, not a second button
            competing for attention. */}
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
