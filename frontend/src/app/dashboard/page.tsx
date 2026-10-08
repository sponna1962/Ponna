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

export default function DashboardPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [nudge, setNudge] = useState<{ message: string; suggestedMessage: string } | null>(null);
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number } | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [milestones, setMilestones] = useState<{ type: string; label: string; emoji: string; achievedAt: string }[]>([]);
  const [newBadge, setNewBadge] = useState<{ label: string; emoji: string } | null>(null);
  const [timeAnalytics, setTimeAnalytics] = useState<{ overallAverageSeconds: number; byDifficulty: { difficulty: string; averageSeconds: number; sampleSize: number }[] } | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<{ questionsAnswered: number; timeSpentMinutes: number; currentStreak: number } | null>(null);
  const [weakArea, setWeakArea] = useState<{ subCategoryId: string; subjectId: string; subjectName: string; accuracy: number; overallAccuracy: number; sampleSize: number } | null>(null);
  const [settingWeakAreaPractice, setSettingWeakAreaPractice] = useState(false);
  const [examCountdown, setExamCountdown] = useState<{ subCategoryId: string; subCategoryName: string; examDate: string; daysRemaining: number } | null>(null);

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
    studentFetch('/students/me/share-progress')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setShareToken(s?.active ? s.token : null))
      .catch(() => {});
    studentFetch('/students/me/milestones')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        setMilestones(list);
        // Celebrate only a badge the student hasn't seen a celebration
        // for yet -- localStorage tracks which ones have already been
        // shown, so re-visiting the Dashboard never re-celebrates an old
        // badge, only a genuinely new one since the last visit.
        const seenKey = 'ponna-seen-milestones';
        const seen: string[] = JSON.parse(localStorage.getItem(seenKey) ?? '[]');
        const unseen = list.find((m: any) => !seen.includes(m.type));
        if (unseen) {
          setNewBadge(unseen);
          localStorage.setItem(seenKey, JSON.stringify([...seen, ...list.map((m: any) => m.type)]));
        }
      })
      .catch(() => {});
    studentFetch('/students/me/time-analytics')
      .then((r) => (r.ok ? r.json() : null))
      .then(setTimeAnalytics)
      .catch(() => {});
    studentFetch('/students/me/monthly-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMonthlySummary)
      .catch(() => {});
    studentFetch('/students/me/weak-area')
      .then((r) => (r.ok ? r.json() : null))
      .then(setWeakArea)
      .catch(() => {});
    studentFetch('/students/me/exam-countdown')
      .then((r) => (r.ok ? r.json() : null))
      .then(setExamCountdown)
      .catch(() => {});
  }, []);

  // Sept 2026 — Gamification: tap-to-share a badge (Web Share API on
  // supported devices, WhatsApp link as the fallback). Purely client-side
  // — no new backend endpoint, no tracking of shares.
  async function shareBadge(m: { label: string; emoji: string }) {
    const text = `நான் PONNA-ல் "${m.label}" ${m.emoji} சாதனை பெற்றேன்! நீங்களும் இணையுங்க: https://ponna.in`;
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ text });
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
    } else if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  async function createShareLink() {
    setSharing(true);
    const res = await studentFetch('/students/me/share-progress', { method: 'POST' });
    setSharing(false);
    if (res.ok) {
      const body = await res.json();
      setShareToken(body.token);
    }
  }

  async function revokeShareLink() {
    if (!confirm(t.dashboard.confirmRevokeShare)) return;
    await studentFetch('/students/me/share-progress', { method: 'DELETE' });
    setShareToken(null);
  }

  const overall = data?.buckets.OVERALL;
  const answered = overall?.questionsAnswered ?? 0;
  const correct = overall?.correctAnswers ?? 0;
  const incorrect = answered - correct;
  const accuracy = answered > 0 ? Math.round(overall!.averagePercent) : 0;
  const hasAnswered = answered > 0;

  const insight = !hasAnswered ? t.dashboard.insightEmpty : t.dashboard.insightSome(answered, correct);

  const SECTION_H2 = { fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: '22px 0 10px', display: 'flex', alignItems: 'center', gap: 8 } as const;
  const MARK = <span aria-hidden="true" style={{ width: 5, height: 18, borderRadius: 3, background: '#E2B04A', display: 'inline-block' }} />;
  const LABEL = { fontSize: 12.5, fontWeight: 700, color: 'var(--color-gold)', margin: '0 0 4px' } as const;
  const BOX = { background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '14px 16px' } as const;
  const PILL_BTN = { display: 'inline-block', padding: '10px 18px', borderRadius: 6, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 13.5, border: 'none', cursor: 'pointer' } as const;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, paddingBottom: 30, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 70px', background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E2B04A' }} />
        ) : null}
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.dashboard.title}</h1>
        {streak && streak.currentStreak > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: '#8a3b00', background: 'var(--color-goldDisc)', padding: '5px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            🔥 {streak.currentStreak}
          </span>
        )}
      </div>

      {/* Overall performance — the one thing students look at first. */}
      <div style={{ margin: '-56px 16px 14px', background: COLORS.head1, borderBottom: '4px solid #E2B04A', borderRadius: 20, padding: '20px 16px', color: '#fff', boxShadow: '0 14px 30px -18px rgba(0,0,0,0.6)' }}>
        <div style={{ width: 140, height: 140, borderRadius: '50%', margin: '0 auto 6px', background: `conic-gradient(#E2B04A 0 ${accuracy}%, rgba(255,255,255,0.18) 0)`, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 112, height: 112, borderRadius: '50%', background: '#0f4a52', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{accuracy}%</span>
            <small style={{ fontSize: 12, color: '#FFE9A8', marginTop: 4 }}>{t.dashboard.overallTitle}</small>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          {[
            { n: answered, label: t.dashboard.answered, color: '#fff' },
            { n: correct, label: t.dashboard.correct, color: '#9ff0b5' },
            { n: incorrect, label: t.dashboard.incorrect, color: '#ffb4a8' },
          ].map((x) => (
            <div key={x.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 4px', textAlign: 'center' }}>
              <b style={{ display: 'block', fontSize: 22, color: x.color }}>{x.n}</b>
              <small style={{ fontSize: 11.5, color: '#d7ece9', lineHeight: 1.3, display: 'block' }}>{x.label}</small>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {/* Milestone celebration (finalized requirement) — shown once per
            newly-achieved badge, dismissible, never re-shown for the same
            badge on a later visit. */}
        {newBadge && (
          <div onClick={() => setNewBadge(null)} style={{ ...BOX, background: 'var(--color-goldDisc)', border: '1.5px solid #E2B04A', marginBottom: 12, textAlign: 'center', cursor: 'pointer' }}>
            <p style={{ fontSize: 28, margin: '0 0 4px' }}>{newBadge.emoji}</p>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, margin: 0 }}>{t.dashboard.newBadge(newBadge.label)}</p>
          </div>
        )}

        {/* Sept 2026 — Exam Countdown (Personalization). Same data/rules as Home. */}
        {examCountdown && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-goldDisc)', border: '1.5px solid #E2B04A', borderRadius: 10, padding: '12px 16px', marginBottom: 12 }}>
            <span style={{ fontSize: 26 }}>⏳</span>
            <div>
              <b style={{ fontSize: 20, display: 'block', fontFamily: FONT_FAMILY, color: COLORS.ink }}>இன்னும் {examCountdown.daysRemaining} நாட்கள்</b>
              <small style={{ fontSize: 12.5, color: COLORS.inkMuted }}>{examCountdown.subCategoryName}</small>
            </div>
          </div>
        )}

        {/* Sept 2026 — "this month" effort summary. Same /students/me/monthly-summary as Home. */}
        {monthlySummary && monthlySummary.questionsAnswered > 0 && (
          <div style={{ ...BOX, marginBottom: 12 }}>
            <p style={LABEL}>இந்த மாதம் / This Month</p>
            <p style={{ fontSize: 15, color: COLORS.ink, fontWeight: 600, margin: 0 }}>
              {monthlySummary.questionsAnswered} கேள்விகள் · {monthlySummary.timeSpentMinutes} நிமிடங்கள்
              {monthlySummary.currentStreak > 0 && <> · {monthlySummary.currentStreak} நாள் streak</>}
            </p>
          </div>
        )}

        {/* Sept 2026 — Weak-Area Alert. Same source/rules as Home. */}
        {weakArea && (
          <div style={{ background: 'var(--color-goldLight)', border: '1px solid #F3D9A8', borderLeft: '5px solid #D99A1E', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
            <p style={{ ...LABEL, color: 'var(--color-gold)' }}>கவனிக்க வேண்டிய பகுதி / Weak Area</p>
            <p style={{ fontSize: 14.5, color: COLORS.ink, margin: '0 0 10px', lineHeight: 1.6 }}>
              <strong>{weakArea.subjectName}</strong>-ல் உங்க accuracy {weakArea.accuracy}% (overall {weakArea.overallAccuracy}%).
            </p>
            <button
              disabled={settingWeakAreaPractice}
              onClick={async () => {
                setSettingWeakAreaPractice(true);
                await studentFetch(`/subject-preference/${weakArea.subCategoryId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subjectIds: [weakArea.subjectId], topicIds: [] }),
                });
                window.location.href = '/quiz';
              }}
              style={{ ...PILL_BTN, background: '#92400E', color: '#fff' }}
            >
              {settingWeakAreaPractice ? '...' : 'இப்போ Practice பண்ணுங்க'}
            </button>
          </div>
        )}

        {/* Performance Insight */}
        <div style={{ ...BOX, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div>
            <p style={LABEL}>{t.dashboard.insightLabel}</p>
            <p style={{ fontSize: 14.5, color: COLORS.ink, lineHeight: 1.6, margin: 0 }}>{insight}</p>
          </div>
        </div>

        {/* Ask Ponna proactive nudge (finalized requirement). Rule-based,
            computed server-side; only shows when something genuinely
            actionable applies, silently absent otherwise. */}
        {nudge && (
          <a
            href={`/ask-ponna?prefill=${encodeURIComponent(nudge.suggestedMessage)}`}
            style={{ ...BOX, background: 'var(--color-goldDisc)', border: '1.5px solid #E2B04A', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start', textDecoration: 'none' }}
          >
            <span style={{ fontSize: 20 }}>🎯</span>
            <div>
              <p style={LABEL}>Ask Ponna</p>
              <p style={{ fontSize: 14.5, color: COLORS.ink, lineHeight: 1.6, margin: 0 }}>{nudge.message}</p>
            </div>
          </a>
        )}

        {/* Performance by Difficulty — Medium/Hard only. */}
        <h2 style={SECTION_H2}>{MARK}{t.dashboard.byDifficulty}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <DifficultyCard label={t.dashboard.buckets.MEDIUM} bucket={data?.buckets.MEDIUM} />
          <DifficultyCard label={t.dashboard.buckets.HARD} bucket={data?.buckets.HARD} />
        </div>

        {/* Your Rank */}
        <h2 style={SECTION_H2}>{MARK}{t.dashboard.rank}</h2>
        <div style={{ ...BOX, padding: 16, background: data?.rankUnlocked ? 'var(--color-goldDisc)' : 'var(--color-card)', border: data?.rankUnlocked ? '1.5px solid #E2B04A' : `1px solid ${COLORS.line}` }}>
          {data?.rankUnlocked ? (
            overall?.rank != null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <p style={{ fontFamily: FONT_FAMILY, fontSize: 38, fontWeight: 800, color: COLORS.ink, margin: 0, lineHeight: 1 }}>{overall.rank}</p>
                <div>
                  <p style={{ fontSize: 12.5, color: COLORS.inkMuted, fontWeight: 600, margin: '0 0 3px' }}>{t.dashboard.currentRank}</p>
                  <p style={{ fontSize: 15, color: COLORS.ink, fontWeight: 700, margin: '0 0 2px' }}>
                    {accuracy}% {t.dashboard.rankAccuracy}
                  </p>
                  <p style={{ fontSize: 12.5, color: COLORS.inkMuted, margin: 0 }}>{t.dashboard.rankPositionNote}</p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.dashboard.notEligible}</p>
            )
          ) : data && !data.planEligible ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 20, lineHeight: 1.3 }}>🔒</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, margin: '0 0 4px' }}>{t.dashboard.rankLockedFree}</p>
                <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 12, lineHeight: 1.6 }}>{t.dashboard.rankLockedFreeSub}</p>
                <a href="/plans" style={PILL_BTN}>{t.dashboard.upgrade}</a>
              </div>
            </div>
          ) : data && !data.profileComplete ? (
            <>
              <p style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, margin: '0 0 10px' }}>{t.dashboard.completeProfileForRank}</p>
              <a href="/profile?complete=1" style={PILL_BTN}>{t.dashboard.completeProfileForRank}</a>
            </>
          ) : null}
        </div>

        {/* Time-Management Analytics (finalized requirement) — framed as
            "room to improve", never as a negative judgement. Silently
            absent until there's at least some timed data. */}
        {timeAnalytics && (
          <>
            <h2 style={SECTION_H2}>{MARK}{t.dashboard.timeAnalyticsLabel}</h2>
            <div style={BOX}>
              <p style={{ fontSize: 14.5, color: COLORS.ink, margin: '0 0 6px' }}>{t.dashboard.avgTimeOverall(timeAnalytics.overallAverageSeconds)}</p>
              {timeAnalytics.byDifficulty.map((d) => (
                <div key={d.difficulty} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${COLORS.line}`, fontSize: 14 }}>
                  <span style={{ color: COLORS.inkMuted }}>{t.dashboard.buckets[d.difficulty as 'EASY' | 'MEDIUM' | 'HARD'] ?? d.difficulty}</span>
                  <span style={{ fontWeight: 700 }}>{t.dashboard.secondsPerQuestion(d.averageSeconds)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Milestone Badges — silently absent until the first badge is
            earned. Tap a badge to share it (Web Share API, WhatsApp fallback). */}
        {milestones.length > 0 && (
          <>
            <h2 style={SECTION_H2}>{MARK}{t.dashboard.badgesLabel}</h2>
            <div style={{ ...BOX, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {milestones.map((m) => (
                <button
                  key={m.type}
                  onClick={() => shareBadge(m)}
                  style={{ textAlign: 'center', width: 74, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: COLORS.inkMuted }}
                >
                  <span style={{ display: 'block', fontSize: 30 }}>{m.emoji}</span>
                  <span style={{ display: 'block', fontSize: 11.5, margin: '2px 0 0', lineHeight: 1.3 }}>{m.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Parent/Mentor Progress Sharing (finalized requirement) — a
            student-initiated, revocable, read-only public link. Default
            private; never PII. */}
        <h2 style={SECTION_H2}>{MARK}{t.dashboard.shareProgressLabel}</h2>
        <div style={BOX}>
          {shareToken ? (
            <>
              <p style={{ fontSize: 12.5, color: COLORS.inkMuted, marginBottom: 10, wordBreak: 'break-all' }}>
                {typeof window !== 'undefined' ? `${window.location.origin}/shared/${shareToken}` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/shared/${shareToken}`)}
                  style={{ flex: 1, padding: 12, borderRadius: 8, border: `1.5px solid ${COLORS.line}`, background: 'var(--color-field)', color: COLORS.ink, fontSize: 13.5, fontWeight: 700 }}
                >
                  {t.dashboard.copyLink}
                </button>
                <button onClick={revokeShareLink} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1.5px solid var(--color-bad)', background: 'transparent', color: 'var(--color-bad)', fontSize: 13.5, fontWeight: 700 }}>
                  {t.dashboard.revokeLink}
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={createShareLink}
              disabled={sharing}
              style={{ width: '100%', padding: 13, borderRadius: 8, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontSize: 14.5, fontWeight: 700 }}
            >
              {sharing ? '…' : t.dashboard.createShareLink}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function DifficultyCard({ label, bucket }: { label: string; bucket?: Bucket }) {
  const answered = bucket?.questionsAnswered ?? 0;
  const hasData = answered > 0;
  const percent = hasData ? Math.round(bucket!.averagePercent) : 0;

  return (
    <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: '14px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, fontWeight: 600, margin: '0 0 6px' }}>{label}</p>
      <p style={{ fontFamily: FONT_FAMILY, fontSize: 26, fontWeight: 800, color: hasData ? COLORS.ink : COLORS.inkMuted, margin: '0 0 8px' }}>
        {hasData ? `${percent}%` : '—'}
      </p>
      {/* Fixed-height slot either way so both cards stay the same height. */}
      <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8, background: hasData ? COLORS.line : 'transparent' }}>
        {hasData && <div style={{ height: '100%', width: `${percent}%`, background: '#FFD22A' }} />}
      </div>
      <p style={{ fontSize: 12, color: COLORS.inkMuted, lineHeight: 1.4, margin: 'auto 0 0' }}>
        {answered} Questions · {bucket?.correctAnswers ?? 0} Correct
      </p>
    </div>
  );
}
