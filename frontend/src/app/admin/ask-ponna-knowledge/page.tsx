'use client';

// Ask Ponna Knowledge — admin management (Ask Ponna Master Requirement,
// Spec v4/v5/v6, BINDING). Global data, not per-exam -- Current Affairs
// and PONNA's own Feature FAQ. Per-exam data (Verified Exam Facts,
// Cut-off Records, Notification Import) stays on /admin/syllabus,
// alongside the exam selector that scopes them.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type CurrentAffairsItem = { id: string; date: string; headline: string; summary: string; sourceUrl: string | null; examRelevanceNote: string | null; verifiedAt: string };
type FaqEntry = { id: string; featureKey: string; question: string; answer: string };

export default function AskPonnaKnowledgePage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Ask Ponna Knowledge</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        Global data Ask Ponna reads from — Current Affairs (Tier 1 source, before falling back to live search) and PONNA's own Feature FAQ (so Ask Ponna never describes PONNA's features from its own possibly-stale assumptions).
      </p>
      <CurrentAffairsSection />
      <PonnaFaqSection />
    </div>
  );
}

function CurrentAffairsSection() {
  const [items, setItems] = useState<CurrentAffairsItem[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [examRelevanceNote, setExamRelevanceNote] = useState('');
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));

  function load() {
    adminFetch('/admin/current-affairs').then((r) => r.json()).then(setItems);
  }
  useEffect(load, []);

  async function add() {
    if (!headline.trim() || !summary.trim()) return;
    await adminFetch('/admin/current-affairs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, headline, summary, sourceUrl, examRelevanceNote, verifiedAt }),
    });
    setHeadline('');
    setSummary('');
    setSourceUrl('');
    setExamRelevanceNote('');
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this current affairs item?')) return;
    await adminFetch(`/admin/current-affairs/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 17, marginBottom: 12 }}>Current Affairs</h2>
      {items.map((item) => (
        <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 4px' }}>{new Date(item.date).toLocaleDateString()}</p>
              <p style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>{item.headline}</p>
              <p style={{ fontSize: 13, margin: '0 0 6px' }}>{item.summary}</p>
              {item.examRelevanceNote && (
                <p style={{ fontSize: 12, color: '#0f172a', background: '#f1f5f9', padding: '6px 8px', borderRadius: 6 }}>
                  <b>PONNA relevance:</b> {item.examRelevanceNote}
                </p>
              )}
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                  source
                </a>
              )}
            </div>
            <button onClick={() => remove(item.id)} style={{ fontSize: 11, color: '#dc2626', height: 'fit-content' }}>
              Delete
            </button>
          </div>
        </div>
      ))}
      {items.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>No current affairs items yet.</p>}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Headline" style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }} />
        </div>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Summary (the news fact itself)"
          rows={2}
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <textarea
          value={examRelevanceNote}
          onChange={(e) => setExamRelevanceNote(e.target.value)}
          placeholder="PONNA's own exam-relevance note (kept separate from the news fact -- e.g. 'relevant for TNPSC GS Current Affairs section')"
          rows={2}
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Source URL" style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
          <input type="date" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
        </div>
        <button onClick={add} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
          + Add Current Affairs Item
        </button>
      </div>
    </div>
  );
}

function PonnaFaqSection() {
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [featureKey, setFeatureKey] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  function load() {
    adminFetch('/admin/ponna-faq').then((r) => r.json()).then(setEntries);
  }
  useEffect(load, []);

  async function add() {
    if (!featureKey.trim() || !question.trim() || !answer.trim()) return;
    await adminFetch('/admin/ponna-faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureKey, question, answer }),
    });
    setQuestion('');
    setAnswer('');
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this FAQ entry?')) return;
    await adminFetch(`/admin/ponna-faq/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>PONNA Feature FAQ</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
        Canonical answers about PONNA's own features -- e.g. featureKey "review_mistakes", "daily_challenge", "subject_preference", "annual_plan".
      </p>
      {entries.map((e) => (
        <div key={e.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>{e.featureKey}</span>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '6px 0 2px' }}>{e.question}</p>
              <p style={{ fontSize: 13, margin: 0 }}>{e.answer}</p>
            </div>
            <button onClick={() => remove(e.id)} style={{ fontSize: 11, color: '#dc2626', height: 'fit-content' }}>
              Delete
            </button>
          </div>
        </div>
      ))}
      {entries.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>No FAQ entries yet.</p>}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <input
          value={featureKey}
          onChange={(e) => setFeatureKey(e.target.value)}
          placeholder="Feature key (e.g. review_mistakes)"
          style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Question (e.g. 'What is Review Mistakes?')"
          style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer"
          rows={3}
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <button onClick={add} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
          + Add FAQ Entry
        </button>
      </div>
    </div>
  );
}
