'use client';

// Home — the post-login landing page. Deliberately minimal: this is an
// exam-practice platform, not a content hub, so the only thing on this
// screen is the single action a student comes here to do. Detailed
// performance lives on /dashboard (via the menu), not here.
//
// No plan/quota/"Free" mention here by design (finalized requirement) — the
// homepage's job is to immediately communicate what PONNA is and get the
// student into practice, not surface pricing or usage details.
//
// The "Start Practising" button and the "Practice" menu item both go to
// the same /quiz page — no duplicate flow (per the finalized requirement).

import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <strong style={{ fontSize: 16 }}>PONNA.in</strong>
        </div>
        <LanguageToggle />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
        {/* whiteSpace: pre-line turns the \n in translations.ts into a real
            line break — the headline is meant to always show as exactly 2
            lines, especially on mobile (finalized requirement). */}
        <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.25, marginBottom: 12, whiteSpace: 'pre-line' }}>
          {t.home.greeting}
        </h1>
        <p style={{ fontSize: 16, color: '#475569', marginBottom: 32, lineHeight: 1.5 }}>{t.home.subtext}</p>

        <a
          href="/quiz"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: 16,
            borderRadius: 12,
            background: '#0f172a',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          {t.home.startToday}
        </a>
      </div>
    </main>
  );
}
