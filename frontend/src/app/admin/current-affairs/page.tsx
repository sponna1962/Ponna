'use client';

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Current Affairs Quick-Entry — implements §7.2: a fast, minimal form for
// entering ~5 current affairs questions a day. No exam type/sub-type or
// difficulty required upfront (defaults applied server-side) — the whole
// point is speed, since this is meant to be used repeatedly, every day.
//
// Sept 2026 (explicit requirement: daily, not weekly, every morning,
// covering the PREVIOUS day's real news) — added an AI-assisted "Generate
// Today's Batch" section above this same manual form. The real job runs
// automatically every morning via cron (see scheduled-jobs.ts); this
// button is only for manually testing that or backfilling a day it
// missed. Both paths write to the exact same place (Question rows,
// category CURRENT_AFFAIRS) -- this manual quick-entry form stays useful
// for a same-day urgent item the AI batch didn't cover yet.

const emptyForm = {
  questionText: '', optionA: '', optionB: '', optionC: '', optionD: '',
  correctOption: 'A', language: 'TA',
};

export default function CurrentAffairsPage() {
  const [form, setForm] = useState(emptyForm);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ created: number; skippedNoResults: boolean } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  async function generateTodaysBatch() {
    setGenerating(true);
    setGenError(null);
    setGenResult(null);
    try {
      const treeRes = await adminFetch('/admin/exam-taxonomy');
      const tree = await treeRes.json();
      let groupIvId: string | null = null;
      outer: for (const purpose of tree) {
        for (const authority of purpose.authorities ?? []) {
          for (const category of authority.categories ?? []) {
            for (const sub of category.subCategories ?? []) {
              if (sub.name === 'Group - IV') {
                groupIvId = sub.id;
                break outer;
              }
            }
          }
        }
      }
      if (!groupIvId) throw new Error('Group - IV Sub-Category not found');

      const res = await adminFetch('/admin/current-affairs/generate-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subCategoryId: groupIvId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to generate');
      setGenResult(body);
    } catch (err: any) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

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
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Current Affairs</h1>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>🤖 AI-Assisted Daily Batch</p>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>
          Runs automatically every morning (drafts questions from yesterday's real Tamil Nadu/India news, via
          Gemini's own Google Search). This button is only for manually testing that or backfilling a missed day.
          Always drafts — review and publish from the{' '}
          <a href="/admin/questions?status=DRAFT" style={{ color: '#0f172a', fontWeight: 600 }}>
            Questions page (DRAFT filter)
          </a>
          .
        </p>
        <button
          onClick={generateTodaysBatch}
          disabled={generating}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          {generating ? 'Generating…' : "Generate Today's Batch Now"}
        </button>
        {genError && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{genError}</p>}
        {genResult && (
          <p style={{ fontSize: 12, color: '#166534', marginTop: 8 }}>
            {genResult.skippedNoResults ? 'No significant events found for yesterday — nothing drafted.' : `Drafted ${genResult.created} question rows.`}
          </p>
        )}
      </div>

      <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>✍️ Manual Quick Add</p>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        For a same-day urgent item the AI batch hasn't covered yet. Difficulty defaults to Medium
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
