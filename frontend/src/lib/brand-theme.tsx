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
};

/** The actual variable definitions for both themes — injected once, in
 * the root layout, as a plain <style> tag (this app has no separate
 * global.css file). [data-theme='dark'] on <html> (set by
 * theme-context.tsx) switches which block applies. */
export function ThemeStyles() {
  return (
    <style>{`
      :root {
        --color-paper: #FAFAF7;
        --color-paperAlt: #F4F0E6;
        --color-ink: #1A2238;
        --color-inkMuted: #535A72;
        --color-gold: #A8791F;
        --color-goldLight: #EFE0BC;
        --color-line: #E4DFD0;
      }
      [data-theme='dark'] {
        --color-paper: #14161F;
        --color-paperAlt: #1D2030;
        --color-ink: #F0EFE9;
        --color-inkMuted: #A8ABC0;
        --color-gold: #D9A94A;
        --color-goldLight: #3A331C;
        --color-line: #2E3145;
      }
    `}</style>
  );
}


export const DISPLAY_FONT = "'Bitter', 'Noto Sans Tamil', 'Noto Sans', serif";

export function BitterFontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Bitter:wght@400;600;700;800&display=swap" rel="stylesheet" />
    </>
  );
}
