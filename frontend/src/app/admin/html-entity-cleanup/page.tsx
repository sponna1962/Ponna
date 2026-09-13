'use client';

// HTML Entity Cleanup (Sept 2026) — deterministic, non-AI fix for
// literal undecoded HTML entity codes (e.g. "&deg;" instead of "°")
// found in question content. Scans the WHOLE bank (not a sample) since
// this is a fast, cheap query, not an AI call.

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Issue = { questionId: string; field: string; before: string; after: string };

export default function HtmlEntityCleanupPage() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<{ count: number; questionsAffected: number; issues: Issue[] } | null>(null);
  const [fixResult, setFixResult] = useState<{ questionsFixed: number; fieldsFixed: number } | null>(null);

  async function scan() {
    setScanning(true);
    setFixResult(null);
    try {
      const res = await adminFetch('/admin/html-entity-cleanup/scan');
      setResult(await res.json());
    } finally {
      setScanning(false);
    }
  }

  async function fixAll() {
    if (!confirm('Apply the decode to every affected field shown below? This directly updates those questions — deterministic, no per-question review needed.')) return;
    setFixing(true);
    try {
      const res = await adminFetch('/admin/html-entity-cleanup/fix-all', { method: 'POST' });
      setFixResult(await res.json());
      setResult(null);
    } finally {
      setFixing(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>HTML Entity Cleanup</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 680, lineHeight: 1.6 }}>
        Finds literal, undecoded HTML entity codes (e.g. &quot;&amp;deg;&quot; instead of &quot;°&quot;) in question
        content — usually left over from copy-pasting from a web source. This is a deterministic, lossless fix (a
        fixed table of known entities), so it scans the entire question bank at once and can be applied without a
        per-question review, unlike AI Question Audit.
      </p>

      <button
        onClick={scan}
        disabled={scanning}
        style={{ padding: '10px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 16, marginRight: 8 }}
      >
        {scanning ? 'Scanning…' : 'Scan Whole Question Bank'}
      </button>

      {fixResult && (
        <div style={{ padding: 14, borderRadius: 8, background: '#DCFCE7', color: '#166534', fontSize: 13, marginBottom: 16 }}>
          ✅ Fixed {fixResult.fieldsFixed} field(s) across {fixResult.questionsFixed} question(s).
        </div>
      )}

      {result && (
        <div style={{ maxWidth: 900 }}>
          <p style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
            {result.count} field(s) affected across {result.questionsAffected} question(s).
          </p>

          {result.count > 0 && (
            <button
              onClick={fixAll}
              disabled={fixing}
              style={{ padding: '10px 20px', borderRadius: 8, background: '#166534', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}
            >
              {fixing ? 'Fixing…' : `Fix All ${result.count} Field(s)`}
            </button>
          )}

          {result.issues.slice(0, 50).map((issue, i) => (
            <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#94a3b8' }}>
                {issue.field} · {issue.questionId.slice(0, 8)}…
              </span>
              <p style={{ margin: '4px 0 0', color: '#b91c1c' }}>Before: {issue.before}</p>
              <p style={{ margin: '2px 0 0', color: '#166534' }}>After: {issue.after}</p>
            </div>
          ))}
          {result.issues.length > 50 && <p style={{ fontSize: 12, color: '#94a3b8' }}>…and {result.issues.length - 50} more (all will still be fixed by "Fix All").</p>}
        </div>
      )}
    </div>
  );
}
