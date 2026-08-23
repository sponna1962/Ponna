'use client';

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Current Affairs Quick-Entry — implements §7.2: a fast, minimal form for
// entering ~5 current affairs questions a day. No exam type/sub-type or
// difficulty required upfront (defaults applied server-side) — the whole
// point is speed, since this is meant to be used repeatedly, every day.

const emptyForm = {
  questionText: '', optionA: '', optionB: '', optionC: '', optionD: '',
  correctOption: 'A', language: 'TA',
};

export default function CurrentAffairsPage() {
  const [form, setForm] = useState(emptyForm);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(publish: boolean) {
    setError(null);
    setJustAdded(null);
    const res = await adminFetch('/admin/questions/current-affairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, publish }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to add question');
      return;
    }
    setJustAdded(publish ? 'Added and published.' : 'Saved as draft.');
    setForm(emptyForm); // reset immediately so the next entry can start right away
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Current Affairs — Quick Add</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Fast entry for daily current affairs questions. Difficulty defaults to Medium
        (editable later from the main Questions list) and relevance date is set to today,
        which drives the recency-based allocation priority (see Settings).
      </p>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20 }}>
        <textarea
          placeholder="Question"
          value={form.questionText}
          onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          style={{ width: '100%', padding: 10, marginBottom: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
          rows={2}
        />
        {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((opt, i) => (
          <input
            key={opt}
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            value={form[opt]}
            onChange={(e) => setForm({ ...form, [opt]: e.target.value })}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        ))}

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13 }}>
          <label>
            Correct:{' '}
            <select value={form.correctOption} onChange={(e) => setForm({ ...form, correctOption: e.target.value })}>
              {['A', 'B', 'C', 'D'].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label>
            Language:{' '}
            <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option value="TA">Tamil</option>
              <option value="EN">English</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => submit(true)}
            style={{ flex: 1, padding: 12, borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600 }}
          >
            Publish
          </button>
          <button
            onClick={() => submit(false)}
            style={{ flex: 1, padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600 }}
          >
            Save as Draft
          </button>
        </div>

        {justAdded && <p style={{ color: '#16a34a', fontSize: 13, marginTop: 12 }}>{justAdded}</p>}
        {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}
