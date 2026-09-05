'use client';

// Your Performance — final UI polish pass (finalized requirement).
// UI/UX only, no backend logic touched — reuses existing dashboard data.
// Only Medium/Hard difficulty (system has no Easy tier). Recent Practice
// and View Leaderboard stay omitted — no backend data/page exists for
// either yet, and the brief explicitly says not to add them here.

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

// One shared card system for every section — same border, radius, and a
// consistent horizontal padding scale — so nothing on the page reads as
// visually disconnected from anything else.
const CARD = { border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: '16px 16px' };

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [nudge, setNudge] = useState<{ message: string; suggestedMessage: string } | null>(null);
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number } | null>(null);

  useEffect(() => {
    studentFetch('/students/me/dashboard')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
    studentFetch('/students/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setPhotoUrl(p?.photoUrl ?? null))
      .catch(() => {});
    studentFetch('/ask-ponna/nudge')
      .then((r) => (r.ok ? r.json() : null))
      .then(setNudge)
      .catch(() => {});
    studentFetch('/students/me/streak')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStreak)
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <StudentMenu />
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${COLORS.line}` }} />
        ) : null}
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.dashboard.title}</h1>
        {streak && streak.currentStreak > 0 && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 13,
              fontWeight: 700,
              color: '#B4544A',
              background: COLORS.goldLight,
              padding: '4px 10px',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            🔥 {streak.currentStreak}
          </span>
        )}
      </div>

      {/* Overall Performance — fully vertical, centered composition: label,
          ring, then one compact stats line. No side-by-side layout, so
          there's no leftover space on the left/right of a narrow ring. */}
      <div style={{ ...CARD, marginBottom: 12, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: COLORS.inkMuted, fontWeight: 600, letterSpacing: 0.3, margin: '0 0 12px' }}>{t.dashboard.overallTitle}</p>
        <ProgressRing percent={accuracy} />
        <p style={{ fontSize: 13, color: COLORS.ink, margin: '14px 0 0' }}>
          <b style={{ color: COLORS.ink, fontWeight: 700 }}>{answered}</b> {t.dashboard.answered}
          <span style={{ color: COLORS.line, margin: '0 8px' }}>·</span>
          <b style={{ color: COLORS.gold, fontWeight: 700 }}>{correct}</b> {t.dashboard.correct}
          <span style={{ color: COLORS.line, margin: '0 8px' }}>·</span>
          <b style={{ color: '#B4544A', fontWeight: 700 }}>{incorrect}</b> {t.dashboard.incorrect}
        </p>
      </div>

      {/* Performance Insight — same card system as everything else,
          tinted rather than bordered-plain to read as "a note", not
          another stat block. */}
      <div style={{ ...CARD, background: COLORS.paperAlt, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 14, lineHeight: 1.4 }}>💡</span>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: COLORS.inkMuted, margin: '0 0 3px', letterSpacing: 0.3 }}>{t.dashboard.insightLabel}</p>
          <p style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.55, margin: 0 }}>{insight}</p>
        </div>
      </div>

      {/* Ask Ponna proactive nudge (finalized requirement — "world-class"
          polish, proactive not just reactive). Rule-based, computed
          server-side, no AI call for this card itself — only shows when
          something genuinely actionable applies (long inactivity, a real
          weak area, or a pending-mistakes backlog); silently absent
          otherwise, never a generic filler message. */}
      {nudge && (
        <a
          href={`/ask-ponna?prefill=${encodeURIComponent(nudge.suggestedMessage)}`}
          style={{ ...CARD, background: COLORS.goldLight, marginBottom: 18, display: 'flex', gap: 10, alignItems: 'flex-start', textDecoration: 'none' }}
        >
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>🎯</span>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#7A5A14', margin: '0 0 3px', letterSpacing: 0.3 }}>Ask Ponna</p>
            <p style={{ fontSize: 13, color: COLORS.ink, lineHeight: 1.55, margin: 0 }}>{nudge.message}</p>
          </div>
        </a>
      )}

      {/* Performance by Difficulty — Medium/Hard only, equal-width and
          equal-height regardless of whether a progress bar renders. */}
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: '0 0 10px' }}>{t.dashboard.byDifficulty}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <DifficultyCard label={t.dashboard.buckets.MEDIUM} bucket={data?.buckets.MEDIUM} />
        <DifficultyCard label={t.dashboard.buckets.HARD} bucket={data?.buckets.HARD} />
      </div>

      {/* Your Rank */}
      <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 700, color: COLORS.ink, margin: '0 0 10px' }}>{t.dashboard.rank}</h2>
      <div style={{ ...CARD, background: data?.rankUnlocked ? COLORS.goldLight : 'transparent', borderColor: data?.rankUnlocked ? COLORS.gold : COLORS.line }}>
        {data?.rankUnlocked ? (
          overall?.rank != null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <p style={{ fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 800, color: COLORS.ink, margin: 0, lineHeight: 1 }}>{overall.rank}</p>
              <div>
                <p style={{ fontSize: 11, color: COLORS.inkMuted, fontWeight: 600, margin: '0 0 3px' }}>{t.dashboard.currentRank}</p>
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 16, lineHeight: 1.3 }}>🔒</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>{t.dashboard.rankLockedFree}</p>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 10, lineHeight: 1.5 }}>{t.dashboard.rankLockedFreeSub}</p>
              <a
                href="/plans"
                style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 7, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
              >
                {t.dashboard.upgrade}
              </a>
            </div>
          </div>
        ) : data && !data.profileComplete ? (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, margin: '0 0 10px' }}>{t.dashboard.completeProfileForRank}</p>
            <a
              href="/profile?complete=1"
              style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 7, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 12 }}
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
  const size = 84;
  const stroke = 7;
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
        <span style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 800, color: COLORS.ink, lineHeight: 1 }}>{percent}%</span>
      </div>
    </div>
  );
}

function DifficultyCard({ label, bucket }: { label: string; bucket?: Bucket }) {
  const answered = bucket?.questionsAnswered ?? 0;
  const hasData = answered > 0;
  const percent = hasData ? Math.round(bucket!.averagePercent) : 0;

  return (
    <div style={{ ...CARD, padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 12, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 10 }}>{label}</p>
      <p style={{ fontFamily: FONT_FAMILY, fontSize: 23, fontWeight: 800, color: hasData ? COLORS.ink : COLORS.inkMuted, margin: '0 0 10px' }}>
        {hasData ? `${percent}%` : '—'}
      </p>
      {/* Fixed-height slot either way — a real bar when there's data, an
          equal-height blank spacer when there isn't — so both cards stay
          the same height instead of the no-data card looking shorter. */}
      <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 10, background: hasData ? COLORS.line : 'transparent' }}>
        {hasData && <div style={{ height: '100%', width: `${percent}%`, background: COLORS.gold }} />}
      </div>
      <p style={{ fontSize: 11, color: COLORS.inkMuted, lineHeight: 1.4, marginTop: 'auto' }}>
        {answered} Questions · {bucket?.correctAnswers ?? 0} Correct
      </p>
    </div>
  );
}
