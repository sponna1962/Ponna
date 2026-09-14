'use client';

// Subject Classification admin page (Sept 2026, Group IV first). See
// schema.prisma's own header comment on SubjectClassificationRun.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Run = {
  id: string;
  label: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalQuestions: number;
  processedQuestions: number;
  autoAppliedCount: number;
  needsReviewCount: number;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  errorMessage: string | null;
};

type ReviewItem = {
  id: string;
  confidence: number;
  aiNotes: string | null;
  previousSubjectName: string | null;
  suggestedSubject: { name: string };
  question: { questionText: string; optionA: string; optionB: string; optionC: string; optionD: string };
};

export default function SubjectClassificationPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [sampleSize, setSampleSize] = useState(500);
  const [scopeSubCategoryId, setScopeSubCategoryId] = useState('');
  const [subCategoryOptions, setSubCategoryOptions] = useState<{ id: string; label: string }[]>([]);
  const [starting, setStarting] = useState(false);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  function load() {
    adminFetch('/admin/subject-classification/runs')
      .then((r) => r.json())
      .then(setRuns)
      .catch(() => setRuns([]));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then((tree: any[]) => {
        const flat: { id: string; label: string }[] = [];
        for (const purpose of tree) {
          for (const authority of purpose.authorities ?? []) {
            for (const category of authority.categories ?? []) {
              for (const sub of category.subCategories ?? []) {
                flat.push({ id: sub.id, label: `${authority.name} → ${category.name} → ${sub.name}` });
              }
            }
          }
        }
        setSubCategoryOptions(flat);
      })
      .catch(() => setSubCategoryOptions([]));
  }, []);

  async function startRun() {
    if (!scopeSubCategoryId) {
      setError('Pick an exam first.');
      return;
    }
    setError(null);
    setStarting(true);
    try {
      const res = await adminFetch('/admin/subject-classification/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleSize,
          subCategoryId: scopeSubCategoryId,
          label: `Subject classification — ${subCategoryOptions.find((o) => o.id === scopeSubCategoryId)?.label ?? 'exam'} — ${sampleSize} questions (${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })})`,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to start run');
      }
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function cancelRun(runId: string) {
    if (!confirm('Stop this run? Questions already classified keep their applied/pending state.')) return;
    setCancellingRunId(runId);
    try {
      await adminFetch(`/admin/subject-classification/runs/${runId}/cancel`, { method: 'POST' });
      load();
    } finally {
      setCancellingRunId(null);
    }
  }

  async function toggleReview(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    setLoadingReview(true);
    try {
      const res = await adminFetch(`/admin/subject-classification/runs/${runId}/needs-review`);
      setReviewItems(res.ok ? await res.json() : []);
    } finally {
      setLoadingReview(false);
    }
  }

  async function applyResult(resultId: string) {
    setApplyingId(resultId);
    try {
      await adminFetch(`/admin/subject-classification/results/${resultId}/apply`, { method: 'POST' });
      setReviewItems((items) => items.filter((i) => i.id !== resultId));
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Subject Classification</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 640, lineHeight: 1.6 }}>
        AI content-based classification: reads each question and decides which of the exam's official Subjects (set
        up under Diagnostics) it actually belongs to -- for questions currently tagged with a legacy batch/source
        label instead of a real topic. Confidence ≥ 85% applies automatically (logged for reversibility);
        below that is left here for manual review.
      </p>

      {error && <p style={{ fontSize: 13, color: '#b91c1c', marginBottom: 12 }}>{error}</p>}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 24, background: '#f8fafc' }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 4 }}>Exam:</label>
          <select
            value={scopeSubCategoryId}
            onChange={(e) => setScopeSubCategoryId(e.target.value)}
            style={{ width: '100%', maxWidth: 420, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          >
            <option value="">Select an exam…</option>
            {subCategoryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 13, color: '#334155' }}>
            Sample size:{' '}
            <input
              type="number"
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value) || 0)}
              style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', marginLeft: 4 }}
            />
          </label>
          <button
            onClick={startRun}
            disabled={starting || sampleSize <= 0}
            style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {starting ? 'Starting…' : 'Start Run'}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Runs</h2>
      {runs.map((r) => (
        <div key={r.id} style={{ border: r.status === 'RUNNING' ? '2px solid #0f172a' : '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>{r.label}</p>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {r.processedQuestions}/{r.totalQuestions} processed · ⚡ {r.autoAppliedCount} auto-applied · {r.needsReviewCount} need review
                {r.model && <> · model: {r.model}</>}
                {r.estimatedCostUsd != null && <> · ~${r.estimatedCostUsd.toFixed(3)} est. cost</>}
              </p>
              {r.errorMessage && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 4 }}>{r.errorMessage}</p>}
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 10px',
                borderRadius: 10,
                fontWeight: 700,
                background: r.status === 'RUNNING' ? '#fef3c7' : r.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2',
                color: r.status === 'RUNNING' ? '#92400e' : r.status === 'COMPLETED' ? '#166534' : '#991b1b',
              }}
            >
              {r.status}
            </span>
          </div>
          {r.status === 'RUNNING' && (
            <button
              onClick={() => cancelRun(r.id)}
              disabled={cancellingRunId === r.id}
              style={{ marginTop: 8, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #b91c1c', color: '#b91c1c', background: '#fff', cursor: 'pointer' }}
            >
              {cancellingRunId === r.id ? 'Cancelling…' : 'Cancel Run'}
            </button>
          )}
          {r.needsReviewCount > 0 && (
            <button
              onClick={() => toggleReview(r.id)}
              style={{ marginTop: 8, marginLeft: 8, fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #0f172a', color: '#0f172a', background: '#fff', cursor: 'pointer' }}
            >
              {expandedRunId === r.id ? 'Hide Review Queue' : `Review ${r.needsReviewCount} Low-Confidence`}
            </button>
          )}

          {expandedRunId === r.id && (
            <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              {loadingReview && <p style={{ fontSize: 12, color: '#64748b' }}>Loading…</p>}
              {!loadingReview &&
                reviewItems.map((item) => (
                  <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13 }}>
                    <p style={{ fontWeight: 600, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{item.question.questionText}</p>
                    <p style={{ color: '#475569', marginBottom: 6 }}>
                      A. {item.question.optionA} &nbsp; B. {item.question.optionB} &nbsp; C. {item.question.optionC} &nbsp; D. {item.question.optionD}
                    </p>
                    <p style={{ marginBottom: 4 }}>
                      Suggested: <strong>{item.suggestedSubject.name}</strong> ({item.confidence}% confidence)
                      {item.previousSubjectName && <> — was: {item.previousSubjectName}</>}
                    </p>
                    {item.aiNotes && <p style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{item.aiNotes}</p>}
                    <button
                      onClick={() => applyResult(item.id)}
                      disabled={applyingId === item.id}
                      style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #166534', color: '#166534', background: '#fff', cursor: 'pointer' }}
                    >
                      {applyingId === item.id ? 'Applying…' : 'Apply This Subject'}
                    </button>
                  </div>
                ))}
              {!loadingReview && reviewItems.length === 0 && <p style={{ fontSize: 12, color: '#64748b' }}>Nothing left to review.</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
