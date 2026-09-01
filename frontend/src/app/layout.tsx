import type { Metadata } from 'next';
import { LanguageProvider } from '../lib/language-context';

export const metadata: Metadata = {
  title: 'PONNA - Competitive Exam Practice',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
};

// LanguageProvider (§4.5) wraps the whole app here so every page shares one
// language state, persisted in localStorage — see lib/language-context.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Noto Sans Tamil — the browser's default system font renders Tamil
            poorly on many devices (outlined/broken-looking glyphs, especially
            on Windows without a Tamil font installed). Noto Sans covers both
            Tamil and Latin scripts cleanly in one family, so English text
            stays visually consistent with Tamil rather than font-switching. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Noto Sans Tamil', 'Noto Sans', -apple-system, sans-serif", margin: 0 }}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
