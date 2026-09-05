import type { Metadata } from 'next';
import { LanguageProvider } from '../lib/language-context';
import { ThemeProvider } from '../lib/theme-context';
import { ThemeStyles } from '../lib/brand-theme';

export const metadata: Metadata = {
  title: 'PONNA.in — TNPSC & TNTET Exam Practice | Previous Papers, Instant Answers',
  description:
    'Practice for TNPSC and TNTET with previous exam questions, expert-designed practice questions, and instant answers after every question. Affordable exam preparation for Tamil Nadu students — practice anytime, in Tamil or English.',
  keywords: ['TNPSC practice', 'TNTET practice', 'TNPSC previous papers', 'TNTET previous papers', 'TNPSC online test', 'TNTET online test', 'PONNA'],
  manifest: '/manifest.json',
  themeColor: '#0f172a',
};

// LanguageProvider (§4.5) wraps the whole app here so every page shares one
// language state, persisted in localStorage — see lib/language-context.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <ThemeStyles />
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
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
