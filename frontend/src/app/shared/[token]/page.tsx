'use client';

// Public Shared Progress page (finalized requirement — Parent/Mentor
// Progress Sharing). No login required -- reads a student-generated,
// revocable token. Only ever shows safe summary data (name, accuracy,
// streak, subject-level performance) -- the backend guarantees no
// phone/email/PII is ever included in this response.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
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
    <main style={{ maxWidth: 480, margin: '0 auto', background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink, paddingBottom: 24 }}>
      <BitterFontLinks />
      <div style={{ background: 'var(--color-head1)', borderBottom: '3px solid #E2B04A', padding: '18px 16px', textAlign: 'center' }}>
        <span style={{ display: 'inline-block', background: '#fefefe', borderRadius: 10, padding: '5px 12px' }}>
          <Image src="/logo-compact.png" alt="PONNA.in" width={170} height={45} style={{ height: 32, width: 'auto', display: 'block' }} />
        </span>
        <p style={{ fontSize: 12.5, color: '#FFE9A8', margin: '8px 0 0' }}>{t.sharedProgress.subtitle}</p>
      </div>
      <div style={{ padding: 16 }}>

      {summary === null && <p style={{ color: COLORS.inkMuted, fontSize: 13, textAlign: 'center' }}>…</p>}

      {summary === 'invalid' && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: '4px solid #FFD22A', borderRadius: 10, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.sharedProgress.invalid}</p>
        </div>
      )}

      {summary && summary !== 'invalid' && (
        <>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: '4px solid #FFD22A', borderRadius: 10, padding: 22, textAlign: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 12 }}>{summary.name}</p>
            {summary.overallAccuracy !== null ? (
              <>
                <p style={{ fontFamily: FONT_FAMILY, fontSize: 44, fontWeight: 800, color: COLORS.gold, margin: '0 0 4px' }}>{summary.overallAccuracy}%</p>
                <p style={{ fontSize: 12, color: COLORS.inkMuted }}>
                  {t.sharedProgress.overallAccuracy} · {summary.questionsAnswered} {t.sharedProgress.questionsAnswered}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.sharedProgress.notStartedYet}</p>
            )}
          </div>

          {summary.currentStreak > 0 && (
            <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 8, padding: 13, marginBottom: 14, background: COLORS.field, textAlign: 'center' }}>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, margin: 0 }}>
                🔥 {summary.currentStreak} {t.sharedProgress.dayStreak}
              </p>
            </div>
          )}

          {summary.byDifficulty.length > 0 && (
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderLeft: '4px solid #FFD22A', borderRadius: 8, padding: 14 }}>
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
      </div>
    </main>
  );
}
