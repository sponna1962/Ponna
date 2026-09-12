'use client';

// AI Question Quality Audit — admin page (Sept 2026, Phase 1 pilot).
// Flag-only, same principle as Question Reports: confirming/dismissing a
// flag here NEVER edits the Question itself — admin uses the existing
// Questions page Edit flow for that, separately, via "Edit Question" below.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type IssueType =
  | 'WRONG_ANSWER'
  | 'MULTIPLE_CORRECT_OPTIONS'
  | 'UNCLEAR_OR_INVALID_QUESTION'
  | 'WRONG_EXPLANATION'
  | 'LANGUAGE_ISSUE'
  | 'LIKELY_DUPLICATE'
  | 'WRONG_MAPPING'
  | 'WRONG_DIFFICULTY'
  | 'FACTUAL_CONCERN'
  | 'CROSS_EXAM_APPLICABLE';

const ISSUE_LABELS: Record<IssueType, string> = {
  WRONG_ANSWER: 'Wrong answer',
  MULTIPLE_CORRECT_OPTIONS: 'Multiple correct options',
  UNCLEAR_OR_INVALID_QUESTION: 'Unclear / invalid question',
  WRONG_EXPLANATION: 'Wrong explanation',
  LANGUAGE_ISSUE: 'Language issue',
  LIKELY_DUPLICATE: 'Likely duplicate',
  WRONG_MAPPING: 'Wrong exam mapping',
  WRONG_DIFFICULTY: 'Wrong difficulty',
  FACTUAL_CONCERN: 'Factual concern',
  CROSS_EXAM_APPLICABLE: 'Could also fit another exam',
};

type Run = {
  id: string;
  label: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  totalQuestions: number;
  processedQuestions: number;
  flaggedQuestions: number;
  totalFlags: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

type Flag = {
  id: string;
  issueType: IssueType;
  verdict: 'LIKELY_ISSUE' | 'CANNOT_VERIFY';
  confidence: number;
  aiNotes: string;
  duplicateOfQuestionIds: string[];
  suggestedCorrectOption: 'A' | 'B' | 'C' | 'D' | null;
  suggestedAdditionalSubCategory: { name: string } | null;
  status: 'OPEN' | 'CONFIRMED' | 'DISMISSED';
  createdAt: string;
  question: {
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    explanationTa: string | null;
    explanationEn: string | null;
    language: string;
    difficulty: string | null;
    status: string;
    authority: { name: string } | null;
    examCategory: { name: string } | null;
    subCategory: { name: string } | null;
  };
};

export default function QuestionAuditPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  // Sept 2026 — inline edit, right on this page, instead of navigating
  // to the Questions page and hunting for the same question there.
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: 'A' | 'B' | 'C' | 'D';
    explanationTa: string;
    explanationEn: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [runDetail, setRunDetail] = useState<{ byIssueType: { issueType: IssueType; _count: { _all: number } }[] } | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [flagsLoaded, setFlagsLoaded] = useState(false);
  const [issueFilter, setIssueFilter] = useState<IssueType | ''>('');
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'CONFIRMED' | 'DISMISSED' | ''>('OPEN');
  const [starting, setStarting] = useState(false);
  const [sampleSize, setSampleSize] = useState(1000);
  const [error, setError] = useState<string | null>(null);

  function loadRuns() {
    adminFetch('/admin/question-audit/runs')
      .then((r) => r.json())
      .then((data) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => setRuns([]))
      .finally(() => setRunsLoaded(true));
  }

  useEffect(() => {
    loadRuns();
    // Poll while any run is still RUNNING, so progress/cost update live
    // without a manual refresh.
    const interval = setInterval(() => {
      setRuns((cur) => {
        if (cur.some((r) => r.status === 'RUNNING')) loadRuns();
        return cur;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  function loadFlags(runId: string) {
    setFlagsLoaded(false);
    const params = new URLSearchParams({ runId });
    if (issueFilter) params.set('issueType', issueFilter);
    if (statusFilter) params.set('status', statusFilter);
    adminFetch(`/admin/question-audit/flags?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setFlags(Array.isArray(data) ? data : []))
      .catch(() => setFlags([]))
      .finally(() => setFlagsLoaded(true));

    adminFetch(`/admin/question-audit/runs/${runId}`)
      .then((r) => r.json())
      .then((data) => setRunDetail(data))
      .catch(() => setRunDetail(null));
  }

  useEffect(() => {
    if (selectedRunId) loadFlags(selectedRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRunId, issueFilter, statusFilter]);

  async function startPilot() {
    setError(null);
    setStarting(true);
    try {
      const res = await adminFetch('/admin/question-audit/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleSize, label: `Phase 1 pilot — ${sampleSize} questions` }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Failed to start pilot');
      }
      const run = await res.json();
      setSelectedRunId(run.id);
      loadRuns();
    } catch (err: any) {
      setError(err.message ?? 'Failed to start pilot');
    } finally {
      setStarting(false);
    }
  }

  async function reviewFlag(id: string, status: 'CONFIRMED' | 'DISMISSED', applyAiAnswer?: boolean) {
    await adminFetch(`/admin/question-audit/flags/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, applyAiAnswer }),
    });
    if (selectedRunId) loadFlags(selectedRunId);
  }

  // Sept 2026 — admin-initiated shortcut (the AI itself still never
  // touches a Question — this is a human clicking a real button, same
  // guarantee as everywhere else). Reuses the existing
  // POST /admin/questions/:id/disable endpoint (the same one the
  // Questions page's own Disable action calls) — pulls this question out
  // of circulation immediately, without navigating away to edit it.
  async function disableQuestion(questionId: string) {
    if (!confirm('Disable this question? It will no longer be shown to any student (Practice, Live Exam, etc.) until re-published from the Questions page.')) return;
    await adminFetch(`/admin/questions/${questionId}/disable`, { method: 'POST' });
    if (selectedRunId) loadFlags(selectedRunId);
  }

  function openInlineEdit(f: Flag) {
    setEditingFlagId(f.id);
    setEditForm({
      questionText: f.question.questionText,
      optionA: f.question.optionA,
      optionB: f.question.optionB,
      optionC: f.question.optionC,
      optionD: f.question.optionD,
      correctOption: f.question.correctOption as 'A' | 'B' | 'C' | 'D',
      explanationTa: f.question.explanationTa ?? '',
      explanationEn: f.question.explanationEn ?? '',
    });
  }

  function cancelInlineEdit() {
    setEditingFlagId(null);
    setEditForm(null);
  }

  async function saveInlineEdit(questionId: string) {
    if (!editForm) return;
    setSavingEdit(true);
    try {
      await adminFetch(`/admin/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditingFlagId(null);
      setEditForm(null);
      if (selectedRunId) loadFlags(selectedRunId);
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>AI Question Quality Audit</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 640, lineHeight: 1.6 }}>
        The AI only IDENTIFIES possible problems here — it never edits, disables, publishes, or deletes a question. Confirming or
        dismissing a flag below doesn&apos;t change the question either; fix anything confirmed via the existing{' '}
        <a href="/admin/questions" style={{ color: '#0f172a' }}>
          Questions
        </a>{' '}
        page, or disable it directly below (a real fix still needs editing separately).
      </p>

      {/* Start a new pilot run */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 24, background: '#f8fafc' }}>
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
            onClick={startPilot}
            disabled={starting || sampleSize <= 0}
            style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {starting ? 'Starting…' : 'Start Audit Run'}
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            Stratified: ~70% TNPSC / 20% TNTET / 10% other, PUBLISHED + Medium/Hard only. Runs sequentially in the background.
          </span>
        </div>
        {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 8 }}>{error}</p>}
      </div>

      {/* Runs list */}
      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Runs</h2>
      {!runsLoaded && <p style={{ color: '#94a3b8' }}>Loading…</p>}
      {runsLoaded && runs.length === 0 && <p style={{ color: '#94a3b8' }}>No audit runs yet.</p>}
      {runs.map((r) => (
        <button
          key={r.id}
          onClick={() => setSelectedRunId(r.id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            border: `1.5px solid ${selectedRunId === r.id ? '#0f172a' : '#e2e8f0'}`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 8,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{r.label}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 9px',
                borderRadius: 20,
                color: r.status === 'COMPLETED' ? '#166534' : r.status === 'FAILED' ? '#b91c1c' : '#92400e',
                background: r.status === 'COMPLETED' ? '#DCFCE7' : r.status === 'FAILED' ? '#FEE2E2' : '#FEF3C7',
              }}
            >
              {r.status}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
            {r.processedQuestions}/{r.totalQuestions} processed · {r.flaggedQuestions} flagged · {r.totalFlags} total flags · model:{' '}
            {r.model}
            {r.estimatedCostUsd != null && <> · ~${Number(r.estimatedCostUsd).toFixed(3)} est. cost</>}
            {' · '}
            {r.inputTokens.toLocaleString()} in / {r.outputTokens.toLocaleString()} out tokens
          </p>
          {r.errorMessage && <p style={{ fontSize: 12, color: '#b91c1c', margin: '4px 0 0' }}>{r.errorMessage}</p>}
        </button>
      ))}

      {/* Selected run — issue-type breakdown + flags */}
      {selectedRunId && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>Flags</h2>

          {runDetail && runDetail.byIssueType.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {runDetail.byIssueType.map((g) => (
                <span key={g.issueType} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 14, background: '#f1f5f9', color: '#334155' }}>
                  {ISSUE_LABELS[g.issueType]}: {g._count._all}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as any)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
              <option value="">All issue types</option>
              {(Object.keys(ISSUE_LABELS) as IssueType[]).map((k) => (
                <option key={k} value={k}>
                  {ISSUE_LABELS[k]}
                </option>
              ))}
            </select>
            {(['OPEN', 'CONFIRMED', 'DISMISSED', ''] as const).map((s) => (
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

          {!flagsLoaded && <p style={{ color: '#94a3b8' }}>Loading…</p>}
          {flagsLoaded && flags.length === 0 && <p style={{ color: '#94a3b8' }}>No flags matching this filter.</p>}

          {flags.map((f) => (
            <div key={f.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', background: '#ffedd5', padding: '3px 10px', borderRadius: 12 }}>
                  {ISSUE_LABELS[f.issueType]}
                  {f.verdict === 'CANNOT_VERIFY' && ' — cannot verify'}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  confidence {f.confidence}% · {f.question.authority?.name ?? 'unmapped'}
                  {f.question.examCategory ? ' — ' + f.question.examCategory.name : ''}
                </span>
              </div>

              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{f.question.questionText}</p>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 8, lineHeight: 1.6 }}>
                {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                  const text = { A: f.question.optionA, B: f.question.optionB, C: f.question.optionC, D: f.question.optionD }[letter];
                  const isCorrect = f.question.correctOption === letter;
                  const isAiSuggested = f.suggestedCorrectOption === letter;
                  return (
                    <div
                      key={letter}
                      style={{
                        color: isCorrect ? '#16a34a' : isAiSuggested ? '#b45309' : '#475569',
                        fontWeight: isCorrect || isAiSuggested ? 700 : 400,
                        background: isAiSuggested && !isCorrect ? '#fffbeb' : 'transparent',
                        borderRadius: 4,
                        padding: isAiSuggested && !isCorrect ? '2px 6px' : 0,
                      }}
                    >
                      {letter}. {text} {isCorrect && '✓ (marked correct)'} {isAiSuggested && !isCorrect && '← AI suggests this'}
                    </div>
                  );
                })}
              </div>

              <p style={{ fontSize: 13, color: '#334155', background: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 10 }}>
                <strong>AI notes:</strong> {f.aiNotes}
              </p>

              {f.issueType === 'CROSS_EXAM_APPLICABLE' && f.suggestedAdditionalSubCategory && (
                <p style={{ fontSize: 13, color: '#166534', background: '#f0fdf4', padding: 10, borderRadius: 6, marginBottom: 10 }}>
                  <strong>Suggested additional exam:</strong> {f.suggestedAdditionalSubCategory.name} — confirming ADDS this tag, the existing mapping is kept as-is.
                </p>
              )}

              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                Question status: {f.question.status} · Language: {f.question.language} · Difficulty: {f.question.difficulty ?? 'not set'}
              </p>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => (editingFlagId === f.id ? cancelInlineEdit() : openInlineEdit(f))}
                  style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a', background: editingFlagId === f.id ? '#f1f5f9' : '#fff', cursor: 'pointer' }}
                >
                  {editingFlagId === f.id ? 'Close Edit' : 'Edit Question'}
                </button>
                {f.question.status !== 'DISABLED' && (
                  <button
                    onClick={() => disableQuestion(f.question.id)}
                    style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #b91c1c', color: '#b91c1c', background: '#fff', cursor: 'pointer' }}
                  >
                    Disable Question
                  </button>
                )}
                {f.status !== 'CONFIRMED' && (
                  <button onClick={() => reviewFlag(f.id, 'CONFIRMED')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #16a34a', color: '#16a34a', background: '#fff', cursor: 'pointer' }}>
                    {f.issueType === 'CROSS_EXAM_APPLICABLE' ? 'Confirm — add this tag' : 'Confirm — real issue'}
                  </button>
                )}
                {/* Sept 2026 — a distinct, explicit admin action: applies
                    the AI's suggested option directly (correctOption
                    update), then auto-dismisses this question's flags —
                    separate from plain Confirm, which only marks the
                    flag reviewed without changing the question. */}
                {f.issueType === 'WRONG_ANSWER' && f.suggestedCorrectOption && f.status !== 'DISMISSED' && (
                  <button
                    onClick={() => reviewFlag(f.id, 'CONFIRMED', true)}
                    style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #b45309', color: '#b45309', background: '#fffbeb', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Confirm &amp; Apply AI&apos;s Answer ({f.suggestedCorrectOption})
                  </button>
                )}
                {f.status !== 'DISMISSED' && (
                  <button onClick={() => reviewFlag(f.id, 'DISMISSED')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #94a3b8', color: '#64748b', background: '#fff', cursor: 'pointer' }}>
                    Dismiss — false positive
                  </button>
                )}
                {f.status !== 'OPEN' && (
                  <span style={{ fontSize: 12, padding: '6px 4px', color: '#94a3b8' }}>
                    {f.status === 'CONFIRMED' ? '✓ Confirmed' : '✕ Dismissed'}
                  </span>
                )}
              </div>

              {editingFlagId === f.id && editForm && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc' }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 2 }}>Question text</label>
                  <textarea
                    value={editForm.questionText}
                    onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                    rows={2}
                    style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, resize: 'vertical' }}
                  />

                  {(['A', 'B', 'C', 'D'] as const).map((letter) => (
                    <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <input
                        type="radio"
                        name={`correct-${f.id}`}
                        checked={editForm.correctOption === letter}
                        onChange={() => setEditForm({ ...editForm, correctOption: letter })}
                        title="Mark as correct answer"
                      />
                      <span style={{ fontSize: 12, width: 14 }}>{letter}.</span>
                      <input
                        value={editForm[({ A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD' } as const)[letter]]}
                        onChange={(e) => setEditForm({ ...editForm, [({ A: 'optionA', B: 'optionB', C: 'optionC', D: 'optionD' } as const)[letter]]: e.target.value })}
                        style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      />
                    </div>
                  ))}

                  <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 2, marginTop: 6 }}>Explanation (Tamil)</label>
                  <textarea
                    value={editForm.explanationTa}
                    onChange={(e) => setEditForm({ ...editForm, explanationTa: e.target.value })}
                    rows={2}
                    style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, resize: 'vertical' }}
                  />
                  <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 2 }}>Explanation (English)</label>
                  <textarea
                    value={editForm.explanationEn}
                    onChange={(e) => setEditForm({ ...editForm, explanationEn: e.target.value })}
                    rows={2}
                    style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 10, resize: 'vertical' }}
                  />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => saveInlineEdit(f.question.id)}
                      disabled={savingEdit}
                      style={{ fontSize: 12, padding: '8px 16px', borderRadius: 6, border: 'none', background: '#166534', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {savingEdit ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={cancelInlineEdit}
                      style={{ fontSize: 12, padding: '8px 16px', borderRadius: 6, border: '1px solid #94a3b8', color: '#64748b', background: '#fff', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
