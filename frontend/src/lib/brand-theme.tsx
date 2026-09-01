// Shared brand theme — grounded in the name "Ponna" (பொன்ன), which means
// gold in Tamil. Gold is therefore the one accent color across the site,
// paired with a deep ink navy (exam-pen-ink feel) on a warm paper
// background, rather than a generic palette. BITTER_FONT_LINKS is the
// <link> markup for the slab-serif display face (Bitter) used for
// headlines site-wide — loaded via a plain stylesheet link (not
// next/font/google) so it works the same in every 'use client' page
// without a build-time font fetch.

export const COLORS = {
  paper: '#FAFAF7',
  paperAlt: '#F4F0E6',
  ink: '#1A2238',
  inkMuted: '#535A72',
  gold: '#A8791F',
  goldLight: '#EFE0BC',
  line: '#E4DFD0',
};

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
