'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Question Management — implements §7.1: add individual questions, list with
// status filter, publish/unpublish, disable, manage difficulty, and full
// edit-in-place (question text, options, correct answer) — including for
// already-published questions, so a typo or wrong answer key can be fixed
// without disabling and re-adding the question.

type Question = {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DISABLED';
  difficulty: 'MEDIUM' | 'HARD' | null;
  aiSuggestedDifficulty: 'MEDIUM' | 'HARD' | null;
  aiConfidence: number | null;
};

const emptyForm = {
  questionText: '', optionA: '', optionB: '', optionC: '', optionD: '',
  correctOption: 'A', language: 'TA', difficulty: '',
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [statusFilter, setStatusFilter] = useState('DRAFT');
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = "add new" mode; a question id = "editing that question"

  async function loadQuestions() {
    const res = await adminFetch(`/admin/questions?status=${statusFilter}`);
    const data = await res.json();
    setQuestions(data.items ?? []);
  }

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function startEdit(q: Question) {
    setEditingId(q.id);
    setForm({
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      language: 'TA', // language isn't editable here; kept for the shared form shape
      difficulty: q.difficulty ?? '',
    });
    setFormError(null);
    setShowForm(true);
  }

  async function submitForm() {
    setFormError(null);

    if (editingId) {
      // Editing an existing question — PATCH, works the same whether it's
      // currently Draft, Published, or Disabled; status is untouched here.
      const res = await adminFetch(`/admin/questions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: form.questionText,
          optionA: form.optionA,
          optionB: form.optionB,
          optionC: form.optionC,
          optionD: form.optionD,
          correctOption: form.correctOption,
          difficulty: form.difficulty || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setFormError(body.error ?? 'Failed to save changes');
        return;
      }
    } else {
      const res = await adminFetch('/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, difficulty: form.difficulty || undefined }),
      });
      if (!res.ok) {
        const body = await res.json();
        setFormError(body.error ?? 'Failed to add question');
        return;
      }
    }

    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    loadQuestions();
  }

  async function setStatus(id: string, action: 'publish' | 'disable' | 'draft') {
    await adminFetch(`/admin/questions/${id}/${action}`, { method: 'POST' });
    loadQuestions();
  }

  async function setDifficulty(id: string, difficulty: string) {
    await adminFetch(`/admin/questions/${id}/difficulty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty }),
    });
    loadQuestions();
  }

  async function classifyNow(id: string) {
    await adminFetch(`/admin/questions/${id}/classify`, { method: 'POST' });
    loadQuestions();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>Questions</h1>
        <button
          onClick={() => (showForm ? setShowForm(false) : startAdd())}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}
        >
          {showForm ? 'Cancel' : '+ Add Question'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 24, maxWidth: 560 }}>
          <h2 style={{ fontSize: 14, marginBottom: 12, color: '#64748b' }}>
            {editingId ? 'Edit Question' : 'New Question'}
          </h2>
          <textarea
            placeholder="Question text"
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>
              Correct:{' '}
              <select value={form.correctOption} onChange={(e) => setForm({ ...form, correctOption: e.target.value })}>
                {['A', 'B', 'C', 'D'].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            {!editingId && (
              <label style={{ fontSize: 13 }}>
                Language:{' '}
                <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="TA">Tamil</option>
                  <option value="EN">English</option>
                </select>
              </label>
            )}
            <label style={{ fontSize: 13 }}>
              Difficulty:{' '}
              <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                <option value="">Unset (AI will suggest)</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </label>
          </div>
          <button onClick={submitForm} style={{ padding: '8px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
            {editingId ? 'Save Changes' : 'Save as Draft'}
          </button>
          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{formError}</p>}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        {['DRAFT', 'PUBLISHED', 'DISABLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '6px 14px',
              marginRight: 8,
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              background: statusFilter === s ? '#0f172a' : '#fff',
              color: statusFilter === s ? '#fff' : '#334155',
              fontSize: 13,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13, color: '#64748b' }}>
            <th style={{ padding: 10 }}>Question</th>
            <th style={{ padding: 10 }}>Difficulty</th>
            <th style={{ padding: 10 }}>AI Suggestion</th>
            <th style={{ padding: 10 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <td style={{ padding: 10, maxWidth: 320 }}>
                {q.questionText}
                {!q.difficulty && (
                  <div style={{ color: '#d97706', fontSize: 11, marginTop: 4 }}>
                    ⚠ No difficulty set — won't appear in any student quiz until set below
                  </div>
                )}
              </td>
              <td style={{ padding: 10 }}>
                <select value={q.difficulty ?? ''} onChange={(e) => setDifficulty(q.id, e.target.value)}>
                  <option value="">—</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </td>
              <td style={{ padding: 10, color: '#64748b' }}>
                {q.aiSuggestedDifficulty ? `${q.aiSuggestedDifficulty} (${q.aiConfidence?.toFixed(0)}%)` : '—'}
              </td>
              <td style={{ padding: 10 }}>
                <button onClick={() => startEdit(q)} style={{ marginRight: 8, fontSize: 12 }}>Edit</button>
                {q.status !== 'PUBLISHED' && (
                  <button onClick={() => setStatus(q.id, 'publish')} style={{ marginRight: 8, fontSize: 12 }}>Publish</button>
                )}
                {q.status !== 'DISABLED' && (
                  <button onClick={() => setStatus(q.id, 'disable')} style={{ marginRight: 8, fontSize: 12 }}>Disable</button>
                )}
                {q.status === 'DRAFT' && !q.aiSuggestedDifficulty && (
                  <button onClick={() => classifyNow(q.id)} style={{ fontSize: 12 }}>Classify with AI</button>
                )}
              </td>
            </tr>
          ))}
          {questions.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No questions in this status.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
