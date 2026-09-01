'use client';

// Your Performance — final visual refinement pass (finalized requirement).
// UI/UX only, no backend logic touched — reuses existing dashboard data.
//
// Easy removed entirely (system only has Medium/Hard difficulty) — the
// grid is a clean 2-up now, not a 3-up with a permanently-empty slot.
//
// Still intentionally omitted (no backend data/page exists for either,
// and the brief explicitly says not to fake it): Recent Practice, View
// Leaderboard. Revisit once that backend data exists.

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

// One shared card system — same border, radius, and padding scale for
// Overall/Difficulty/Rank, so they read as one visual family even though
// Overall stays the visually dominant one (larger content, not a
// different border/radius).
const CARD = { border: `1px solid ${COLORS.line}`, borderRadius: 14 };

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

  const insight = !hasAnswered ? t.dashboard.insightEmpty : t.dashboard.insightSome(answered, correct);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.dashboard.title}</h1>
      </div>

      {/* Overall Performance — compact, ring + stats read as one unit,
          not a tall card with dead space. */}
      <div style={{ ...CARD, padding: '18px 20px', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: COLORS.inkMuted, fontWeight: 600, letterSpacing: 0.2, marginBottom: 14, textAlign: 'center' }}>
          {t.dashboard.overallTitle}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <ProgressRing percent={accuracy} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Stat value={answered} label={t.dashboard.answered} />
            <Stat value={correct} label={t.dashboard.correct} color={COLORS.gold} />
            <Stat value={incorrect} label={t.dashboard.incorrect} color="#B4544A" />
          </div>
        </div>
      </div>

      {/* Performance Insight — a small panel, not a bare paragraph. */}
      <div style={{ ...CARD, background: COLORS.paperAlt, padding: '12px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 15, lineHeight: 1.3 }}>💡</span>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkMuted, margin: '0 0 3px', letterSpacing: 0.2 }}>{t.dashboard.insightLabel}</p>
          <p style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.55, margin: 0 }}>{insight}</p>
        </div>
      </div>

      {/* Performance by Difficulty — Medium/Hard only, equal-width 2-up. */}
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{t.dashboard.byDifficulty}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
        <DifficultyCard label={t.dashboard.buckets.MEDIUM} bucket={data?.buckets.MEDIUM} />
        <DifficultyCard label={t.dashboard.buckets.HARD} bucket={data?.buckets.HARD} />
      </div>

      {/* Your Rank */}
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{t.dashboard.rank}</h2>
      <div style={{ ...CARD, padding: 18, background: data?.rankUnlocked ? COLORS.goldLight : 'transparent', borderColor: data?.rankUnlocked ? COLORS.gold : COLORS.line }}>
        {data?.rankUnlocked ? (
          overall?.rank != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <p style={{ fontFamily: FONT_FAMILY, fontSize: 36, fontWeight: 800, color: COLORS.ink, margin: 0, lineHeight: 1 }}>{overall.rank}</p>
              <div>
                <p style={{ fontSize: 11, color: COLORS.inkMuted, fontWeight: 600, margin: '0 0 4px' }}>{t.dashboard.currentRank}</p>
                <p style={{ fontSize: 13, color: COLORS.ink, fontWeight: 600, margin: '0 0 2px' }}>
                  {accuracy}% {t.dashboard.rankAccuracy}
                </p>
                <p style={{ fontSize: 11, color: COLORS.inkMuted, margin: 0 }}>{t.dashboard.rankPositionNote}</p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: COLORS.inkMuted, margin: 0 }}>{t.dashboard.notEligible}</p>
          )
        ) : data && !data.planEligible ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: '0 0 5px' }}>{t.dashboard.rankLockedFree}</p>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 12, lineHeight: 1.55 }}>{t.dashboard.rankLockedFreeSub}</p>
              <a
                href="/plans"
                style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 7, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
              >
                {t.dashboard.upgrade}
              </a>
            </div>
          </div>
        ) : data && !data.profileComplete ? (
          <>
            <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>{t.dashboard.completeProfileForRank}</p>
            <a
              href="/profile?complete=1"
              style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 7, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
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
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - percent / 100);

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
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
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 800, color: COLORS.ink, lineHeight: 1 }}>{percent}%</span>
      </div>
    </div>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 700, color: color ?? COLORS.ink }}>{value}</span>
      <span style={{ fontSize: 11, color: COLORS.inkMuted }}>{label}</span>
    </div>
  );
}

function DifficultyCard({ label, bucket }: { label: string; bucket?: Bucket }) {
  const answered = bucket?.questionsAnswered ?? 0;
  const hasData = answered > 0;
  const percent = hasData ? Math.round(bucket!.averagePercent) : 0;

  return (
    <div style={{ ...CARD, padding: '18px 14px', textAlign: 'center' }}>
      <p style={{ fontSize: 12, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 10 }}>{label}</p>
      <p style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, color: hasData ? COLORS.ink : COLORS.inkMuted, margin: '0 0 10px' }}>
        {hasData ? `${percent}%` : '—'}
      </p>
      {/* No progress bar at all when there's no data — an empty/0-width
          bar would visually suggest "0%" rather than "no attempts yet". */}
      {hasData && (
        <div style={{ height: 4, background: COLORS.line, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${percent}%`, background: COLORS.gold }} />
        </div>
      )}
      <p style={{ fontSize: 11, color: COLORS.inkMuted, lineHeight: 1.4, marginTop: hasData ? 0 : 14 }}>
        {answered} Questions · {bucket?.correctAnswers ?? 0} Correct
      </p>
    </div>
  );
}
