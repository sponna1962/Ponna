'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

// Implements §4.4 plus the two-check Rank gate (plan eligible AND profile
// complete). Average %, Questions Answered, Correct Answers are always
// visible. Rank shows one of three states depending on what's missing:
//   - a number, if both gates pass and the student has cleared the §8.1 minimum
//   - "not yet eligible" if gates pass but the minimum-questions threshold isn't met
//   - an "Upgrade" CTA if the plan isn't eligible
//   - a "Complete your profile" CTA if the plan is fine but the profile isn't

type Bucket = { averagePercent: number; questionsAnswered: number; correctAnswers: number; rank: number | null };
type DashboardData = {
  buckets: { OVERALL?: Bucket; MEDIUM?: Bucket; HARD?: Bucket };
  planEligible: boolean;
  profileComplete: boolean;
  rankUnlocked: boolean;
};

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    studentFetch('/students/me/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const buckets = data?.buckets ?? {};

  return (
    <main style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <h1 style={{ fontSize: 20, margin: 0 }}>{t.dashboard.title}</h1>
        </div>
        <LanguageToggle />
      </div>

      {(['OVERALL', 'MEDIUM', 'HARD'] as const).map((bucketKey) => {
        const b = buckets[bucketKey];
        return (
          <section
            key={bucketKey}
            style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 12 }}
          >
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>{t.dashboard.buckets[bucketKey]}</h2>
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
              {data?.rankUnlocked ? (
                <strong>{b?.rank ?? t.dashboard.notEligible}</strong>
              ) : (
                <span style={{ filter: 'blur(4px)', userSelect: 'none' }}>#123</span>
              )}
            </div>

            {!data?.rankUnlocked && data && (
              !data.planEligible ? (
                <a
                  href="/plans"
                  style={{ display: 'block', textAlign: 'center', marginTop: 8, width: '100%', padding: 8, textDecoration: 'none', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                >
                  {t.dashboard.upgrade}
                </a>
              ) : (
                <a
                  href="/profile?complete=1"
                  style={{ display: 'block', textAlign: 'center', marginTop: 8, width: '100%', padding: 8, textDecoration: 'none', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                >
                  {t.dashboard.completeProfileForRank}
                </a>
              )
            )}
          </section>
        );
      })}
    </main>
  );
}
