'use client';

// Home — the post-login landing page. Deliberately minimal: this is an
// exam-practice platform, not a content hub, so the only thing on this
// screen is the single action a student comes here to do. Detailed
// performance lives on /dashboard (via the menu), not here.
//
// The "Start today's quiz" button and the "Practice" menu item both go to
// the same /quiz page — no duplicate flow (per the finalized requirement).

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

export default function HomePage() {
  const { t } = useLanguage();
  const [planLabel, setPlanLabel] = useState<string | null>(null);

  useEffect(() => {
    studentFetch('/students/me/profile')
      .then((r) => r.json())
      .then((profile) => setPlanLabel(profile.planName))
      .catch(() => {});
  }, []);

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
        <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>{t.home.greeting}</h1>
        <p style={{ fontSize: 18, color: '#475569', marginBottom: 32 }}>{t.home.subtext}</p>

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
            marginBottom: 16,
          }}
        >
          {t.home.startToday}
        </a>

        {planLabel && (
          <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
            {planLabel}
          </p>
        )}
      </div>
    </main>
  );
}
