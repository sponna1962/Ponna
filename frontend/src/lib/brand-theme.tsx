// Shared brand theme — grounded in the name "Ponna" (பொன்ன), which means
// gold in Tamil. Gold is therefore the one accent color across the site,
// paired with a deep ink navy (exam-pen-ink feel) on a warm paper
// background, rather than a generic palette. BITTER_FONT_LINKS is the
// <link> markup for the slab-serif display face (Bitter) used for
// headlines site-wide — loaded via a plain stylesheet link (not
// next/font/google) so it works the same in every 'use client' page
// without a build-time font fetch.
//
// Dark Mode (finalized requirement) — COLORS resolves to CSS custom
// properties (var(--color-xxx)) rather than hardcoded hex values, so
// every existing page's `style={{ color: COLORS.ink }}` automatically
// follows whichever theme is active (see ThemeStyles in this file,
// injected once in the root layout) — no page-by-page changes needed.

export const COLORS = {
  paper: 'var(--color-paper)',
  paperAlt: 'var(--color-paperAlt)',
  ink: 'var(--color-ink)',
  inkMuted: 'var(--color-inkMuted)',
  gold: 'var(--color-gold)',
  goldLight: 'var(--color-goldLight)',
  line: 'var(--color-line)',
  // Oct 2026 redesign tokens (defined in ThemeStyles below for both themes).
  card: 'var(--color-card)',
  field: 'var(--color-field)',
  teal: 'var(--color-teal)',
  ok: 'var(--color-ok)',
  bad: 'var(--color-bad)',
  okBg: 'var(--color-okBg)',
  badBg: 'var(--color-badBg)',
  goldDisc: 'var(--color-goldDisc)',
  head1: 'var(--color-head1)',
  head2: 'var(--color-head2)',
  btn: 'var(--color-btn)',
  btnText: 'var(--color-btnText)',
};

/** The actual variable definitions for both themes — injected once, in
 * the root layout, as a plain <style> tag (this app has no separate
 * global.css file). [data-theme='dark'] on <html> (set by
 * theme-context.tsx) switches which block applies. */
export function ThemeStyles() {
  return (
    <style>{`
      :root {
        --color-paper: #FBFAF6;
        --color-paperAlt: #F4F1E8;
        --color-ink: #14253D;
        --color-inkMuted: #596579;
        --color-gold: #C28A16;
        --color-goldLight: #FFF3C4;
        --color-line: #DDD9CE;
        /* Oct 2026 — extra tokens for the redesigned profile page */
        --color-card: #FFFFFF;
        --color-field: #FBF8EE;
        --color-teal: #17835E;
        --color-ok: #17835E;
        --color-bad: #c0392b;
        --color-goldDisc: #FFF7D9;
        --color-head1: #0B3864;
        --color-head2: #0B3864;
        --color-btn: #0B3864;
        --color-btnText: #FFD22A;
        --color-okBg: #E4F4E2;
        --color-badBg: #FCE9E6;
      }
      html, body { background: var(--color-paper); color: var(--color-ink); }
      [data-theme='dark'] {
        --color-paper: #14161F;
        --color-paperAlt: #1D2030;
        --color-ink: #F0EFE9;
        --color-inkMuted: #A8ABC0;
        --color-gold: #D9A94A;
        --color-goldLight: #3A331C;
        --color-line: #2E3145;
        --color-card: #1D2030;
        --color-field: #161827;
        --color-teal: #5cc2b6;
        --color-ok: #4cc16b;
        --color-bad: #ff8a7d;
        --color-goldDisc: #3A331C;
        --color-head1: #0a1a24;
        --color-head2: #14494b;
        --color-btn: #E2B04A;
        --color-btnText: #1b1300;
        --color-okBg: #143323;
        --color-badBg: #3a1c1c;
      }
    `}</style>
  );
}


export const DISPLAY_FONT = "'Bitter', 'Noto Sans Tamil', 'Noto Sans', serif";

// Sept 2026 — Bitter is now requested from the root layout's single
// Google Fonts <link> (merged alongside Noto Sans, one stylesheet
// request instead of two — Lighthouse flagged the second request as a
// render-blocking ~750ms cost). Every page renders inside that root
// layout, so Bitter is already loading by the time any page mounts;
// this is kept as a no-op export so the 27 call sites across the app
// don't all need touching, and so a future per-page font can reuse the
// same call shape.
export function BitterFontLinks() {
  return null;
}
