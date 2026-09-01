'use client';

// Your Performance — redesigned (finalized requirement: simple, beautiful,
// and clearly tell Free-practice students that Rank isn't available to
// them, not just a blurred number).
//
// Rank gating (unchanged logic, just clearer messaging): rankUnlocked
// requires BOTH an eligible paid plan AND a complete profile. Overall
// stats (Average/Answered/Correct) are always visible to everyone,
// regardless of plan — only Rank is gated.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

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

  const overall = data?.buckets.OVERALL;
  const hasAnswered = (overall?.questionsAnswered ?? 0) > 0;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.dashboard.title}</h1>
      </div>

      {/* Overall — the hero metric. One clean number, not another card in
          a repeated stack. */}
      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 20, marginBottom: 12, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 6, fontWeight: 600 }}>{t.dashboard.buckets.OVERALL}</p>
        <p style={{ fontFamily: FONT_FAMILY, fontSize: 44, fontWeight: 800, color: COLORS.gold, margin: '0 0 4px', lineHeight: 1 }}>
          {hasAnswered ? `${overall!.averagePercent.toFixed(0)}%` : '—'}
        </p>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 16 }}>{t.dashboard.avg}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
          <div>
            <p style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: COLORS.ink, margin: '0 0 2px' }}>{overall?.questionsAnswered ?? 0}</p>
            <p style={{ fontSize: 11, color: COLORS.inkMuted }}>{t.dashboard.answered}</p>
          </div>
          <div>
            <p style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: COLORS.ink, margin: '0 0 2px' }}>{overall?.correctAnswers ?? 0}</p>
            <p style={{ fontSize: 11, color: COLORS.inkMuted }}>{t.dashboard.correct}</p>
          </div>
        </div>
      </div>

      {/* Medium / Hard — smaller secondary breakdown, side by side. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {(['MEDIUM', 'HARD'] as const).map((key) => {
          const b = data?.buckets[key];
          const answered = (b?.questionsAnswered ?? 0) > 0;
          return (
            <div key={key} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 6, fontWeight: 600 }}>{t.dashboard.buckets[key]}</p>
              <p style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>
                {answered ? `${b!.averagePercent.toFixed(0)}%` : '—'}
              </p>
              <p style={{ fontSize: 11, color: COLORS.inkMuted }}>
                {b?.correctAnswers ?? 0} / {b?.questionsAnswered ?? 0} {t.dashboard.correct.toLowerCase()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Rank — its own section, with an explicit reason whenever it's
          locked, instead of a blurred number + vague "Upgrade" prompt. */}
      <div style={{ border: `1px solid ${data?.rankUnlocked ? COLORS.gold : COLORS.line}`, borderRadius: 14, padding: 18, background: data?.rankUnlocked ? COLORS.goldLight : 'transparent' }}>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 8, fontWeight: 600 }}>{t.dashboard.rank}</p>

        {data?.rankUnlocked ? (
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 800, color: COLORS.ink, margin: 0 }}>
            {overall?.rank != null ? `#${overall.rank}` : t.dashboard.notEligible}
          </p>
        ) : data && !data.planEligible ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>{t.dashboard.rankLockedFree}</p>
            <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 14 }}>{t.dashboard.rankLockedFreeSub}</p>
            <a
              href="/plans"
              style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}
            >
              {t.dashboard.upgrade}
            </a>
          </>
        ) : data && !data.profileComplete ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{t.dashboard.completeProfileForRank}</p>
            <a
              href="/profile?complete=1"
              style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}
            >
              {t.dashboard.completeProfileForRank}
            </a>
          </>
        ) : (
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.dashboard.notEligible}</p>
        )}
      </div>
    </main>
  );
}
