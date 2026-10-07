import type { Metadata } from 'next';
import Script from 'next/script';
import { LanguageProvider } from '../lib/language-context';
import { ThemeProvider } from '../lib/theme-context';
import { ThemeStyles } from '../lib/brand-theme';
import { InstallPrompt } from '../components/InstallPrompt';
import { LegalFooter } from '../components/LegalFooter';
import { VisitTracker } from '../components/VisitTracker';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.ponna.in'),
  title: 'PONNA.in – TNPSC & TNTET Online Practice | Previous Year Questions',
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
  alternateName: 'PONNA',
  url: 'https://www.ponna.in/',
};

// LanguageProvider (§4.5) wraps the whole app here so every page shares one
// language state, persisted in localStorage — see lib/language-context.tsx.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'light' }}>
      <head>
        <ThemeStyles />
        {/* Sept 2026 — removed maximum-scale=1 (was blocking pinch-to-zoom,
            an accessibility failure per Lighthouse/WCAG 1.4.4 for
            low-vision users). initial-scale is enough to size the layout
            correctly on load without disabling zoom. */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        {/* Bitter (the slab-serif display face used site-wide via
            BitterFontLinks, brand-theme.tsx) is merged into this same
            request rather than loaded as a second <link rel="stylesheet">
            — Lighthouse flagged two separate Google Fonts CSS requests as
            render-blocking (~750ms each). One request, one round trip. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;600;700;800&family=Bitter:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        {/* Oct 2026 — Meta (Facebook/Instagram) Pixel, site-wide, for the
            upcoming ad campaign. Dataset "PONNA.in" (id 1759774275257553),
            created in Events Manager. Fires PageView on every route via
            Next.js's <Script> with the default "afterInteractive" strategy,
            so it loads after the page is interactive without blocking
            first paint. A Purchase event is fired separately on successful
            Razorpay payment (see payment success flow) — not from here. */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1759774275257553');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=1759774275257553&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
      </head>
      <body style={{ fontFamily: "'Noto Sans Tamil', 'Noto Sans', -apple-system, sans-serif", margin: 0 }}>
        <ThemeProvider>
          <LanguageProvider>
            {/* Oct 2026 — footer pinned to the bottom of the screen while a page is
                still loading, so it never flashes at the top and jumps down. */}
            <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1 }}>{children}</div>
              <LegalFooter />
            </div>
            {/* Sept 2026 finalized requirement — global, on every page, not
                buried in Help & Support. See InstallPrompt.tsx for the
                real-PWA-only / no-nagging / already-installed rules. */}
            <InstallPrompt />
            <VisitTracker />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
