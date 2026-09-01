'use client';

// Your Performance — complete visual redesign (finalized requirement).
// Uses ONLY existing backend data (Overall/Medium/Hard performance
// summary + rank gate) — no backend logic changed.
//
// Two things intentionally NOT included this pass, both because the
// backend doesn't provide the data and building it wasn't asked for here:
//   - Recent Practice: no endpoint returns recent session history yet.
//   - View Leaderboard: no leaderboard page/endpoint exists yet.
// Flagged to the user rather than faked or silently dropped.
//
// "Easy" always shows as no-data (—): the Difficulty enum only has
// MEDIUM/HARD in the whole system today, so an Easy bucket can never have
// real answers. Shown anyway (matching the brief's 3-card layout) since it
// costs nothing and is forward-compatible if an Easy tier is added later.

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
  const answered = overall?.questionsAnswered ?? 0;
  const correct = overall?.correctAnswers ?? 0;
  const incorrect = answered - correct;
  const accuracy = answered > 0 ? Math.round(overall!.averagePercent) : 0;
  const hasAnswered = answered > 0;

  const insight = !hasAnswered
    ? t.dashboard.insightEmpty
    : t.dashboard.insightSome(answered, correct);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.dashboard.title}</h1>
      </div>

      {/* Overall Performance — the hero. Ring + big accuracy number. */}
      <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '28px 20px', marginBottom: 14, textAlign: 'center' }}>
        <ProgressRing percent={accuracy} />
        <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: '14px 0 20px', fontWeight: 600, letterSpacing: 0.2 }}>{t.dashboard.overallTitle}</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 28 }}>
          <Stat value={answered} label={t.dashboard.answered} />
          <Stat value={correct} label={t.dashboard.correct} color={COLORS.gold} />
          <Stat value={incorrect} label={t.dashboard.incorrect} color="#B4544A" />
        </div>
      </div>

      {/* Performance Insight — one dynamic sentence, data-driven. */}
      <p style={{ fontSize: 13, color: COLORS.inkMuted, lineHeight: 1.6, marginBottom: 24, padding: '0 4px' }}>{insight}</p>

      {/* Performance by Difficulty */}
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{t.dashboard.byDifficulty}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
        <DifficultyCard label={t.dashboard.buckets.EASY} bucket={undefined} />
        <DifficultyCard label={t.dashboard.buckets.MEDIUM} bucket={data?.buckets.MEDIUM} />
        <DifficultyCard label={t.dashboard.buckets.HARD} bucket={data?.buckets.HARD} />
      </div>

      {/* Your Rank */}
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{t.dashboard.rank}</h2>
      <div style={{ border: `1px solid ${data?.rankUnlocked ? COLORS.gold : COLORS.line}`, borderRadius: 16, padding: 20, background: data?.rankUnlocked ? COLORS.goldLight : 'transparent' }}>
        {data?.rankUnlocked ? (
          overall?.rank != null ? (
            <>
              <p style={{ fontFamily: FONT_FAMILY, fontSize: 40, fontWeight: 800, color: COLORS.ink, margin: '0 0 2px', lineHeight: 1 }}>{overall.rank}</p>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 10 }}>{t.dashboard.currentRank}</p>
              <p style={{ fontSize: 14, color: COLORS.ink, fontWeight: 600, marginBottom: 4 }}>{accuracy}% {t.dashboard.rankAccuracy}</p>
              <p style={{ fontSize: 12, color: COLORS.inkMuted }}>{t.dashboard.rankPositionNote}</p>
            </>
          ) : (
            <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.dashboard.notEligible}</p>
          )
        ) : data && !data.planEligible ? (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 6px' }}>🔒 {t.dashboard.rankLockedFree}</p>
            <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 16, lineHeight: 1.6 }}>{t.dashboard.rankLockedFreeSub}</p>
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
        ) : null}
      </div>
    </main>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 128;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.line} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLORS.gold}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 800, color: COLORS.ink }}>{percent}%</span>
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div>
      <p style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 700, color: color ?? COLORS.ink, margin: '0 0 2px' }}>{value}</p>
      <p style={{ fontSize: 11, color: COLORS.inkMuted }}>{label}</p>
    </div>
  );
}

function DifficultyCard({ label, bucket }: { label: string; bucket?: Bucket }) {
  const answered = bucket?.questionsAnswered ?? 0;
  const hasData = answered > 0;
  const percent = hasData ? Math.round(bucket!.averagePercent) : 0;

  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '14px 8px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 800, color: hasData ? COLORS.ink : COLORS.inkMuted, margin: '0 0 8px' }}>
        {hasData ? `${percent}%` : '—'}
      </p>
      <div style={{ height: 4, background: COLORS.line, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${percent}%`, background: COLORS.gold }} />
      </div>
      <p style={{ fontSize: 10, color: COLORS.inkMuted, lineHeight: 1.4 }}>
        {answered} Q · {bucket?.correctAnswers ?? 0} ✓
      </p>
    </div>
  );
}
