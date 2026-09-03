'use client';

// Question Reports — admin review queue for student "Report an issue"
// submissions (finalized requirement, content quality control). Flag-only:
// resolving/dismissing here never touches the question itself — an admin
// fixes the actual content via the Questions page's Edit modal separately,
// then comes back here to mark the report handled.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Report = {
  id: string;
  reason: 'WRONG_ANSWER' | 'UNCLEAR_OR_TYPO' | 'WRONG_OPTIONS' | 'OTHER';
  comment: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  question: {
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    language: string;
    status: string;
  };
  user: { name: string | null; phone: string | null; email: string | null };
};

const REASON_LABELS: Record<string, string> = {
  WRONG_ANSWER: 'Wrong answer marked',
  UNCLEAR_OR_TYPO: 'Unclear / typo',
  WRONG_OPTIONS: 'Wrong options',
  OTHER: 'Other',
};

export default function QuestionReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED' | ''>('OPEN');
  const [loaded, setLoaded] = useState(false);

  function load() {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    adminFetch(`/admin/question-reports${params}`)
      .then((r) => r.json())
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function setStatus(id: string, status: 'RESOLVED' | 'DISMISSED' | 'OPEN') {
    await adminFetch(`/admin/question-reports/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Question Reports</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Student-submitted "report an issue" flags. Resolving/dismissing here doesn't change the question — edit it from the Questions page,
        then come back and mark it handled.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['OPEN', 'RESOLVED', 'DISMISSED', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              background: statusFilter === s ? '#0f172a' : '#fff',
              color: statusFilter === s ? '#fff' : '#334155',
              fontSize: 13,
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {!loaded && <p style={{ color: '#94a3b8' }}>Loading…</p>}

      {loaded && reports.length === 0 && <p style={{ color: '#94a3b8' }}>No reports here.</p>}

      {reports.map((r) => (
        <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', background: '#ffedd5', padding: '3px 10px', borderRadius: 12 }}>
              {REASON_LABELS[r.reason]}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.createdAt).toLocaleString()}</span>
          </div>

          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{r.question.questionText}</p>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 8, lineHeight: 1.6 }}>
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const text = { A: r.question.optionA, B: r.question.optionB, C: r.question.optionC, D: r.question.optionD }[letter];
              const isCorrect = r.question.correctOption === letter;
              return (
                <div key={letter} style={{ color: isCorrect ? '#16a34a' : '#475569', fontWeight: isCorrect ? 700 : 400 }}>
                  {letter}. {text} {isCorrect && '✓'}
                </div>
              );
            })}
          </div>

          {r.comment && (
            <p style={{ fontSize: 13, color: '#334155', background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 10 }}>
              "{r.comment}"
            </p>
          )}

          <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
            Reported by: {r.user.name ?? r.user.phone ?? r.user.email ?? 'Unknown'} · Question status: {r.question.status} · Language: {r.question.language}
          </p>

          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`/admin/questions?status=${r.question.status}&search=${encodeURIComponent(r.question.questionText.slice(0, 40))}`}
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a', textDecoration: 'none' }}
            >
              Find & Edit Question
            </a>
            {r.status !== 'RESOLVED' && (
              <button onClick={() => setStatus(r.id, 'RESOLVED')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #16a34a', color: '#16a34a', background: '#fff' }}>
                Mark Resolved
              </button>
            )}
            {r.status !== 'DISMISSED' && (
              <button onClick={() => setStatus(r.id, 'DISMISSED')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #94a3b8', color: '#64748b', background: '#fff' }}>
                Dismiss
              </button>
            )}
            {r.status !== 'OPEN' && (
              <button onClick={() => setStatus(r.id, 'OPEN')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', color: '#334155', background: '#fff' }}>
                Reopen
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
