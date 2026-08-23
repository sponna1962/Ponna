'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../../lib/admin-fetch';

// Needs Review Queue — implements §7.3 (AI Classification Review Queue).
// Shows Draft questions the AI has classified below the confidence threshold,
// with its suggestion pre-filled. Admin makes a one-tap Medium/Hard/Publish
// decision rather than entering data from scratch — this is the whole point
// of the AI-assist workflow from §9.

type ReviewQuestion = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  aiSuggestedDifficulty: 'MEDIUM' | 'HARD';
  aiConfidence: number;
};

type AccuracyStats = {
  totalClassified: number;
  matchedAdminDecision: number;
  overriddenByAdmin: number;
  agreementRate: number | null;
};

export default function ReviewQueuePage() {
  const [queue, setQueue] = useState<ReviewQuestion[]>([]);
  const [stats, setStats] = useState<AccuracyStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [queueRes, statsRes] = await Promise.all([
      adminFetch('/admin/questions/needs-review'),
      adminFetch('/admin/ai/accuracy'),
    ]);
    setQueue(await queueRes.json());
    setStats(await statsRes.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, difficulty: 'MEDIUM' | 'HARD') {
    // One tap: set the difficulty (accepting or overriding the AI suggestion) and publish.
    await adminFetch(`/admin/questions/${id}/difficulty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty }),
    });
    await adminFetch(`/admin/questions/${id}/publish`, { method: 'POST' });
    setQueue((q) => q.filter((item) => item.id !== id));
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Needs Review</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 560 }}>
        Questions the AI classified below the confidence threshold. Its suggestion is pre-filled —
        tap the correct difficulty to accept or override, which publishes the question immediately.
      </p>

      {stats && stats.totalClassified > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <Stat label="AI Suggestions" value={stats.totalClassified} color="#0f172a" />
          <Stat label="Admin Agreed" value={stats.matchedAdminDecision} color="#16a34a" />
          <Stat label="Overridden" value={stats.overriddenByAdmin} color="#d97706" />
          {stats.agreementRate !== null && (
            <Stat label="Agreement Rate" value={`${stats.agreementRate.toFixed(0)}%`} color="#0f172a" />
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : queue.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Review queue is empty — nothing waiting on a decision right now.</p>
      ) : (
        queue.map((q) => (
          <div key={q.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12, maxWidth: 600 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>{q.questionText}</p>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 1.6 }}>
              A. {q.optionA} &nbsp; B. {q.optionB} &nbsp; C. {q.optionC} &nbsp; D. {q.optionD}
              <br />
              Correct: <strong>{q.correctOption}</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#0f172a',
                  background: '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                AI suggests: {q.aiSuggestedDifficulty} ({q.aiConfidence.toFixed(0)}% confidence)
              </span>

              <button
                onClick={() => decide(q.id, 'MEDIUM')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: q.aiSuggestedDifficulty === 'MEDIUM' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Medium
              </button>
              <button
                onClick={() => decide(q.id, 'HARD')}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  border: q.aiSuggestedDifficulty === 'HARD' ? '2px solid #0f172a' : '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Hard
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 20px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  );
}
