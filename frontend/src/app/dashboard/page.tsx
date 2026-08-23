'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { apiUrl } from '../../lib/api-config';

// Implements §4.4: identical dashboard layout for free and paid users, plus
// §4.5 language toggle. Average %, Questions Answered, Correct Answers always
// visible. Rank is the single paid-only gate — shown locked/blurred for free users.

type Bucket = { averagePercent: number; questionsAnswered: number; correctAnswers: number; rank: number | null };
type DashboardData = { OVERALL?: Bucket; MEDIUM?: Bucket; HARD?: Bucket };

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData>({});
  const [isPaidUser, setIsPaidUser] = useState(false); // comes from auth/subscription context in production

  useEffect(() => {
    // Placeholder userId — replace with authenticated session user
    fetch(apiUrl('/students/demo-user/dashboard'))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <main style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.dashboard.title}</h1>
        <LanguageToggle />
      </div>

      {(['OVERALL', 'MEDIUM', 'HARD'] as const).map((bucket) => {
        const b = data[bucket];
        return (
          <section
            key={bucket}
            style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 }}
          >
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t.dashboard.buckets[bucket]}</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{t.dashboard.avg}</span>
              <strong>{b ? `${b.averagePercent.toFixed(1)}%` : '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{t.dashboard.answered}</span>
              <strong>{b?.questionsAnswered ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>{t.dashboard.correct}</span>
              <strong>{b?.correctAnswers ?? 0}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{t.dashboard.rank}</span>
              {isPaidUser ? (
                <strong>{b?.rank ?? t.dashboard.notEligible}</strong>
              ) : (
                <span style={{ filter: 'blur(4px)', userSelect: 'none' }}>#123</span>
              )}
            </div>
            {!isPaidUser && (
              <a href="/plans" style={{ display: 'block', textAlign: 'center', marginTop: 8, width: '100%', padding: 8, textDecoration: 'none', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}>
                {t.dashboard.upgrade}
              </a>
            )}
          </section>
        );
      })}
    </main>
  );
}
