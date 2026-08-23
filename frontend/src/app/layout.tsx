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
    <html lang="ta">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
