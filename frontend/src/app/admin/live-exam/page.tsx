'use client';

// Live Exam — Admin Config page (Sept 2026, completes Method 1: draw
// from the existing question bank). Sets the real exam pattern
// (question count, duration, marks, negative marking) per Sub-Category —
// verified against the official notification, never guessed (sourceUrl
// + verifiedAt exist for exactly this reason). This was previously a
// real gap: the backend route existed but no admin UI page called it,
// so Live Exam could never actually be turned on for any exam.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type SubCategoryOption = { id: string; label: string };

type Config = {
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarkingFraction: number;
  sourceUrl: string | null;
  verifiedAt: string;
} | null;

export default function LiveExamAdminPage() {
  const [options, setOptions] = useState<SubCategoryOption[]>([]);
  const [subCategoryId, setSubCategoryId] = useState('');
  const [config, setConfig] = useState<Config>(null);
  const [loaded, setLoaded] = useState(false);

  const [questionCount, setQuestionCount] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [marksPerQuestion, setMarksPerQuestion] = useState(1);
  const [negativeMarkingFraction, setNegativeMarkingFraction] = useState(0.25);
  const [sourceUrl, setSourceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then((tree: any[]) => {
        const flat: SubCategoryOption[] = [];
        for (const purpose of tree) {
          for (const authority of purpose.authorities ?? []) {
            for (const category of authority.categories ?? []) {
              for (const sub of category.subCategories ?? []) {
                if (sub.studentVisible === false) continue;
                flat.push({ id: sub.id, label: `${authority.name} → ${category.name} → ${sub.name}` });
              }
            }
          }
        }
        setOptions(flat);
      })
      .catch(() => setOptions([]));
  }, []);

  useEffect(() => {
    if (!subCategoryId) {
      setConfig(null);
      setLoaded(false);
      return;
    }
    setLoaded(false);
    adminFetch(`/admin/mock-exam/${subCategoryId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Config) => {
        setConfig(c);
        if (c) {
          setQuestionCount(c.questionCount);
          setDurationMinutes(c.durationMinutes);
          setMarksPerQuestion(c.marksPerQuestion);
          setNegativeMarkingFraction(c.negativeMarkingFraction);
          setSourceUrl(c.sourceUrl ?? '');
        } else {
          setQuestionCount(100);
          setDurationMinutes(60);
          setMarksPerQuestion(1);
          setNegativeMarkingFraction(0.25);
          setSourceUrl('');
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [subCategoryId]);

  async function save() {
    if (!subCategoryId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch(`/admin/mock-exam/${subCategoryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionCount,
          durationMinutes,
          marksPerQuestion,
          negativeMarkingFraction,
          sourceUrl: sourceUrl || undefined,
          verifiedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      const saved = await res.json();
      setConfig(saved);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function removeConfig() {
    if (!subCategoryId || !confirm('Turn OFF Live Exam for this exam? Students will no longer be able to start it.')) return;
    await adminFetch(`/admin/mock-exam/${subCategoryId}`, { method: 'DELETE' });
    setConfig(null);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Live Exam — Exam Pattern Config</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 640, lineHeight: 1.6 }}>
        Live Exam draws questions from the existing Question bank for the selected exam — no separate upload needed here. Set the
        REAL exam pattern (question count, duration, marking) verified against the official notification. Sept 2026: opens only
        Saturday-Sunday IST, one attempt per weekend, results released Monday 00:00 IST for everyone who attempted that weekend.
      </p>

      <select
        value={subCategoryId}
        onChange={(e) => setSubCategoryId(e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 20, minWidth: 320 }}
      >
        <option value="">Select an exam…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      {subCategoryId && loaded && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, maxWidth: 420 }}>
          <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 700, color: config ? '#166534' : '#B4544A' }}>
            {config ? '● Live Exam is ON for this exam' : '○ Not configured yet — Live Exam is OFF'}
          </div>

          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginTop: 12 }}>Question count</label>
          <input type="number" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />

          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginTop: 12 }}>Duration (minutes)</label>
          <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />

          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginTop: 12 }}>Marks per question</label>
          <input type="number" step="0.5" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(Number(e.target.value))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />

          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginTop: 12 }}>Negative marking fraction (0 = none, 0.25 = 1/4th)</label>
          <input type="number" step="0.05" value={negativeMarkingFraction} onChange={(e) => setNegativeMarkingFraction(Number(e.target.value))} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />

          <label style={{ display: 'block', fontSize: 12, color: '#475569', marginTop: 12 }}>Official notification URL (source)</label>
          <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }} />

          {error && <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={save} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {saving ? 'Saving…' : config ? 'Update' : 'Turn ON Live Exam'}
            </button>
            {config && (
              <button onClick={removeConfig} style={{ padding: '10px 16px', borderRadius: 6, background: '#fff', color: '#b91c1c', border: '1px solid #b91c1c', fontSize: 13, cursor: 'pointer' }}>
                Turn Off
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
