'use client';

// Public Shared Progress page (finalized requirement — Parent/Mentor
// Progress Sharing). No login required -- reads a student-generated,
// revocable token. Only ever shows safe summary data (name, accuracy,
// streak, subject-level performance) -- the backend guarantees no
// phone/email/PII is ever included in this response.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiUrl } from '../../../lib/api-config';
import { useLanguage } from '../../../lib/language-context';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';

type Summary = {
  name: string;
  overallAccuracy: number | null;
  questionsAnswered: number;
  currentStreak: number;
  longestStreak: number;
  byDifficulty: { bucket: string; accuracy: number; questionsAnswered: number }[];
};

export default function SharedProgressPage() {
  const { t } = useLanguage();
  const params = useParams();
  const token = params?.token as string;
  const [summary, setSummary] = useState<Summary | null | 'invalid'>(null);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl(`/shared/${token}`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSummary(data ?? 'invalid'))
      .catch(() => setSummary('invalid'));
  }, [token]);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: '20px 0 4px', color: COLORS.ink, textAlign: 'center' }}>PONNA</h1>
      <p style={{ fontSize: 12, color: COLORS.inkMuted, textAlign: 'center', marginBottom: 24 }}>{t.sharedProgress.subtitle}</p>

      {summary === null && <p style={{ color: COLORS.inkMuted, fontSize: 13, textAlign: 'center' }}>…</p>}

      {summary === 'invalid' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.sharedProgress.invalid}</p>
        </div>
      )}

      {summary && summary !== 'invalid' && (
        <>
          <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 12 }}>{summary.name}</p>
            {summary.overallAccuracy !== null ? (
              <>
                <p style={{ fontFamily: FONT_FAMILY, fontSize: 40, fontWeight: 800, color: COLORS.gold, margin: '0 0 4px' }}>{summary.overallAccuracy}%</p>
                <p style={{ fontSize: 12, color: COLORS.inkMuted }}>
                  {t.sharedProgress.overallAccuracy} · {summary.questionsAnswered} {t.sharedProgress.questionsAnswered}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.sharedProgress.notStartedYet}</p>
            )}
          </div>

          {summary.currentStreak > 0 && (
            <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 12, padding: 14, marginBottom: 16, background: COLORS.goldLight, textAlign: 'center' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#5C4009', margin: 0 }}>
                🔥 {summary.currentStreak} {t.sharedProgress.dayStreak}
              </p>
            </div>
          )}

          {summary.byDifficulty.length > 0 && (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 10 }}>{t.sharedProgress.byDifficulty}</p>
              {summary.byDifficulty.map((d) => (
                <div key={d.bucket} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                  <span>{d.bucket}</span>
                  <span style={{ fontWeight: 600 }}>
                    {d.accuracy}% ({d.questionsAnswered})
                  </span>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11, color: COLORS.inkMuted, textAlign: 'center', marginTop: 20 }}>{t.sharedProgress.disclaimer}</p>
        </>
      )}
    </main>
  );
}
