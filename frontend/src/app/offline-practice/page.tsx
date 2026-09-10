'use client';

// Offline Practice (Sept 2026, dedicated phase — Accessibility & Reach,
// Priority 2). Download a 50-question pack while online (full content,
// including answers/explanations, cached in IndexedDB — see
// lib/offline-db.ts for why that trade-off is unavoidable for true
// offline use), then practice with zero network. Answers sync back
// automatically once the device reconnects, and each answer's OWN
// recorded time (not the sync time) is what streak backfill uses on the
// backend.

import { useEffect, useState } from 'react';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';
import { studentFetch } from '../../lib/student-fetch';
import {
  getOfflinePack,
  saveOfflinePack,
  recordOfflineAnswer,
  clearOfflinePack,
  type OfflinePackData,
} from '../../lib/offline-db';

export default function OfflinePracticePage() {
  const [pack, setPack] = useState<OfflinePackData | null | 'loading'>('loading');
  const [isOnline, setIsOnline] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    getOfflinePack().then(setPack).catch(() => setPack(null));
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auto-sync once back online, if there's a fully-answered pack waiting.
  useEffect(() => {
    if (isOnline && pack && pack !== 'loading' && pack.answers.length === pack.questions.length && pack.answers.length > 0) {
      syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pack]);

  async function downloadPack() {
    setError(null);
    setDownloading(true);
    try {
      const res = await studentFetch('/students/me/offline-pack', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to download pack');
      }
      const data = await res.json();
      const newPack: OfflinePackData = { packId: data.packId, questions: data.questions, answers: [] };
      await saveOfflinePack(newPack);
      setPack(newPack);
      setCurrentIndex(0);
      setRevealed({});
      setJustSynced(false);
    } catch (err: any) {
      setError(err.message ?? 'Failed to download pack');
    } finally {
      setDownloading(false);
    }
  }

  async function answer(questionId: string, option: 'A' | 'B' | 'C' | 'D') {
    if (revealed[questionId]) return;
    setRevealed((r) => ({ ...r, [questionId]: option }));
    await recordOfflineAnswer(questionId, option);
    const updated = await getOfflinePack();
    setPack(updated);
  }

  async function syncNow() {
    if (!pack || pack === 'loading' || pack.answers.length === 0) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await studentFetch(`/students/me/offline-pack/${pack.packId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: pack.answers }),
      });
      if (!res.ok) throw new Error('Sync failed — will retry automatically once online.');
      await clearOfflinePack();
      setPack(null);
      setJustSynced(true);
    } catch (err: any) {
      setError(err.message ?? 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, minHeight: '100dvh', background: COLORS.paper, color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0 }}>Offline Practice</h1>
      </div>

      <p style={{ fontSize: 12, fontWeight: 700, color: isOnline ? '#166534' : '#B4544A', marginBottom: 16 }}>
        {isOnline ? '🟢 Online' : '🔴 Offline — practice still works, answers will sync automatically once you reconnect'}
      </p>

      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {justSynced && (
        <div style={{ padding: 16, borderRadius: 10, background: '#DCFCE7', marginBottom: 16, fontSize: 14, color: '#166534' }}>
          ✅ உங்க offline answers sync ஆகிடுச்சு! Streak மற்றும் Performance update ஆகியிருக்கும்.
        </div>
      )}

      {pack === 'loading' && <p style={{ color: COLORS.inkMuted }}>Loading…</p>}

      {pack === null && (
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, marginBottom: 20, lineHeight: 1.6 }}>
            Network இல்லாத நேரத்திலும் practice பண்ண, 50 கேள்விகள் இப்போ download பண்ணுங்க. Answers நீங்க திரும்ப online ஆனதும் தானாகவே sync ஆகும்.
          </p>
          <button
            onClick={downloadPack}
            disabled={downloading || !isOnline}
            style={{ padding: '14px 28px', borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}
          >
            {downloading ? 'Downloading…' : isOnline ? '📥 Download Practice Pack' : 'Connect to internet to download'}
          </button>
        </div>
      )}

      {pack && pack !== 'loading' && (
        <div>
          <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 12 }}>
            {Object.keys(revealed).length} / {pack.questions.length} answered
          </p>

          {pack.questions[currentIndex] && (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 6 }}>Q{pack.questions[currentIndex].sequenceNumber}</p>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{pack.questions[currentIndex].questionText}</p>
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const q = pack.questions[currentIndex];
                const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
                const chosen = revealed[q.id];
                const isCorrectOption = q.correctOption === letter;
                let bg = COLORS.paperAlt;
                if (chosen) {
                  if (isCorrectOption) bg = '#DCFCE7';
                  else if (chosen === letter) bg = '#FEE2E2';
                }
                return (
                  <button
                    key={letter}
                    onClick={() => answer(q.id, letter)}
                    disabled={!!chosen}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: bg, marginBottom: 8, fontSize: 14, cursor: chosen ? 'default' : 'pointer' }}
                  >
                    {letter}. {text}
                  </button>
                );
              })}
              {revealed[pack.questions[currentIndex].id] && (
                <p style={{ fontSize: 13, color: COLORS.inkMuted, marginTop: 8, lineHeight: 1.6 }}>
                  {pack.questions[currentIndex].language === 'TA' ? pack.questions[currentIndex].explanationTa : pack.questions[currentIndex].explanationEn}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.paper, cursor: 'pointer' }}
            >
              ← முந்தையது
            </button>
            <button
              disabled={currentIndex >= pack.questions.length - 1}
              onClick={() => setCurrentIndex((i) => Math.min(pack.questions.length - 1, i + 1))}
              style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: COLORS.ink, color: COLORS.paper, cursor: 'pointer' }}
            >
              அடுத்தது →
            </button>
          </div>

          {isOnline && pack.answers.length > 0 && (
            <button
              onClick={syncNow}
              disabled={syncing}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${COLORS.gold}`, background: COLORS.goldLight, color: '#5C4009', fontWeight: 600, cursor: 'pointer' }}
            >
              {syncing ? 'Syncing…' : `Sync ${pack.answers.length} answer(s) now`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
