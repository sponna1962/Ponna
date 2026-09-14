'use client';

// One-time diagnostic page (Sept 2026) — Group IV subject-mismatch
// question counts. See server.ts's own comment on
// GET /admin/diagnostics/group-iv-subject-mismatch for the full context.
// Uses the same adminFetch() every other admin page already uses, so
// the existing admin login carries over automatically — no manual
// token handling needed.

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Result = { subjectName: string; exists: boolean; subjectId?: string; groupIvQuestionCount: number };

export default function DiagnosticsPage() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/diagnostics/group-iv-subject-mismatch');
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Failed to run diagnostic');
        return;
      }
      setResults(body.results);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Diagnostics</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Group IV subject-mismatch question counts — read-only, changes nothing.</p>

      <button
        onClick={run}
        disabled={loading}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}
      >
        {loading ? 'Running…' : 'Run Group IV Subject-Mismatch Check'}
      </button>

      {error && <p style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}

      {results && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: 8 }}>Subject Name</th>
              <th style={{ padding: 8 }}>Exists?</th>
              <th style={{ padding: 8 }}>Group IV Questions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.subjectName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>{r.subjectName}</td>
                <td style={{ padding: 8 }}>{r.exists ? '✅' : '❌ not found'}</td>
                <td style={{ padding: 8, fontWeight: 700 }}>{r.groupIvQuestionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
