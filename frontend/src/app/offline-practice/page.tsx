'use client';

// Offline Practice (Sept 2026, dedicated phase — Accessibility & Reach,
// Priority 2). Download a 75-question pack while online (full content,
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

  const gold4 = '#E2B04A';
  const btn: React.CSSProperties = { width: '100%', padding: 15, borderRadius: 8, background: COLORS.btn, color: COLORS.btnText, border: 'none', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxSizing: 'border-box' };
  const cur = pack && pack !== 'loading' ? pack.questions[currentIndex] : null;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: COLORS.paper, color: COLORS.ink, paddingBottom: pack && pack !== 'loading' ? 96 : 24 }}>
      <BitterFontLinks />
      <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: `3px solid ${gold4}` }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>Offline Practice</h1>
      </div>

      <div style={{ padding: 16 }}>
      <span style={{ display: 'inline-block', padding: '7px 14px', borderRadius: 6, fontSize: 12.5, fontWeight: 700, marginBottom: 14, lineHeight: 1.5, background: isOnline ? COLORS.okBg : COLORS.badBg, color: isOnline ? COLORS.ok : COLORS.bad, border: `1px solid ${isOnline ? COLORS.ok : COLORS.bad}` }}>
        {isOnline ? '🟢 Online' : '🔴 Offline — practice still works, answers will sync automatically once you reconnect'}
      </span>

      {error && <p style={{ color: COLORS.bad, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {justSynced && (
        <div style={{ padding: 16, borderRadius: 8, background: COLORS.okBg, border: `1px solid ${COLORS.ok}`, marginBottom: 16, fontSize: 14, color: COLORS.ok, fontWeight: 600, lineHeight: 1.6 }}>
          ✅ உங்க offline answers sync ஆகிடுச்சு! Streak மற்றும் Performance update ஆகியிருக்கும்.
        </div>
      )}

      {pack === 'loading' && <p style={{ color: COLORS.inkMuted }}>Loading…</p>}

      {pack === null && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: `4px solid ${gold4}`, borderRadius: 10, padding: '30px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📥</div>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: '0 0 20px', lineHeight: 1.65 }}>
            Network இல்லாத நேரத்திலும் practice பண்ண, 75 கேள்விகள் இப்போ download பண்ணுங்க. Answers நீங்க திரும்ப online ஆனதும் தானாகவே sync ஆகும்.
          </p>
          <button onClick={downloadPack} disabled={downloading || !isOnline} style={{ ...btn, opacity: downloading || !isOnline ? 0.6 : 1 }}>
            {downloading ? 'Downloading…' : isOnline ? '📥 Download Practice Pack' : 'Connect to internet to download'}
          </button>
        </div>
      )}

      {pack && pack !== 'loading' && cur && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 10 }}>
            <span>Q{cur.sequenceNumber}</span>
            <span>{Object.keys(revealed).length} / {pack.questions.length} answered</span>
          </div>
          <div style={{ height: 8, background: COLORS.line, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${(Object.keys(revealed).length / pack.questions.length) * 100}%`, background: 'linear-gradient(90deg,#E2B04A,#D99A1E)' }} />
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: `4px solid ${gold4}`, borderRadius: 10, padding: 18, fontSize: cur.questionText.length > 140 ? 16.5 : 17.5, fontWeight: 600, lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{cur.questionText}</div>

          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const q = cur;
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const chosen = revealed[q.id];
            const good = !!chosen && q.correctOption === letter;
            const bad = !!chosen && chosen === letter && q.correctOption !== letter;
            const accent = good ? COLORS.ok : bad ? COLORS.bad : COLORS.line;
            return (
              <button
                key={letter}
                onClick={() => answer(q.id, letter)}
                disabled={!!chosen}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${accent}`, background: good ? COLORS.okBg : bad ? COLORS.badBg : COLORS.card, color: COLORS.ink, marginBottom: 10, fontSize: 15.5, cursor: chosen ? 'default' : 'pointer', boxSizing: 'border-box' }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5, background: good ? COLORS.ok : bad ? COLORS.bad : COLORS.field, border: `1.5px solid ${accent}`, color: good || bad ? '#fff' : COLORS.inkMuted }}>
                  {good ? '✓' : bad ? '✕' : letter}
                </span>
                <span style={{ flex: 1 }}>{text}</span>
              </button>
            );
          })}
          {revealed[cur.id] && (
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderLeft: `4px solid ${gold4}`, borderRadius: 12, padding: '11px 13px', fontSize: 13.5, color: COLORS.inkMuted, lineHeight: 1.7 }}>
              {cur.language === 'TA' ? cur.explanationTa : cur.explanationEn}
            </div>
          )}

          {isOnline && pack.answers.length > 0 && (
            <button
              onClick={syncNow}
              disabled={syncing}
              style={{ width: '100%', padding: 14, borderRadius: 8, border: `1.5px solid ${COLORS.gold}`, background: COLORS.field, color: COLORS.gold, fontWeight: 700, fontSize: 14.5, cursor: 'pointer', marginTop: 14 }}
            >
              {syncing ? 'Syncing…' : `Sync ${pack.answers.length} answer(s) now`}
            </button>
          )}
        </div>
      )}
      </div>

      {pack && pack !== 'loading' && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto', display: 'flex', gap: 10, padding: '14px 16px 16px', background: `linear-gradient(transparent, ${COLORS.paper} 40%)` }}>
          <button
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            style={{ flex: 1, padding: 15, borderRadius: 8, border: `1.5px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.ink, fontWeight: 700, fontSize: 15.5, cursor: 'pointer', opacity: currentIndex === 0 ? 0.5 : 1 }}
          >
            ← முந்தையது
          </button>
          <button
            disabled={currentIndex >= pack.questions.length - 1}
            onClick={() => setCurrentIndex((i) => Math.min(pack.questions.length - 1, i + 1))}
            style={{ flex: 1, padding: 15, borderRadius: 8, border: 'none', background: COLORS.btn, color: COLORS.btnText, fontWeight: 700, fontSize: 15.5, cursor: 'pointer', opacity: currentIndex >= pack.questions.length - 1 ? 0.5 : 1 }}
          >
            அடுத்தது →
          </button>
        </div>
      )}
    </main>
  );
}
