import type { Metadata } from 'next';
import { LanguageProvider } from '../lib/language-context';
import { ThemeProvider } from '../lib/theme-context';
import { ThemeStyles } from '../lib/brand-theme';
import { InstallPrompt } from '../components/InstallPrompt';
import { LegalFooter } from '../components/LegalFooter';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ponna.in'),
  title: 'PONNA.in — TNPSC & TNTET Exam Practice | Previous Papers, Instant Answers',
  description:
    'Practice for TNPSC and TNTET with previous exam questions, expert-designed practice questions, and instant answers after every question. Affordable exam preparation for Tamil Nadu students — practice anytime, in Tamil or English.',
  alternates: { canonical: '/' },
  manifest: '/manifest.json',
  themeColor: '#0f172a',
};

// Organization + WebSite structured data (Sept 2026 SEO requirement) — site-
// wide, once, in the root layout. Page-specific structured data (e.g.
// BreadcrumbList) is added per-page instead.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'PONNA.in',
  url: 'https://www.ponna.in',
  logo: 'https://www.ponna.in/logo-compact.png',
  description: 'Online exam practice platform for TNPSC and TNTET aspirants in Tamil Nadu.',
};
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PONNA.in',
  url: 'https://www.ponna.in',
};

// LanguageProvider (§4.5) wraps the whole app here so every page shares one
// language state, persisted in localStorage — see lib/language-context.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <head>
        <ThemeStyles />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        {/* Sept 2026 — the site has no dark theme; some Android browsers
            (Samsung Internet, Chrome's "Dark theme for web contents") were
            auto-inverting/heuristically re-coloring pages, producing
            washed-out, low-contrast text on devices with OS dark mode on.
            This tells the browser the site is explicitly light-only, so it
            stops applying that heuristic. */}
        <meta name="color-scheme" content="light" />
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
      </head>
      <body style={{ fontFamily: "'Noto Sans Tamil', 'Noto Sans', -apple-system, sans-serif", margin: 0 }}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
            <LegalFooter />
            {/* Sept 2026 finalized requirement — global, on every page, not
                buried in Help & Support. See InstallPrompt.tsx for the
                real-PWA-only / no-nagging / already-installed rules. */}
            <InstallPrompt />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
