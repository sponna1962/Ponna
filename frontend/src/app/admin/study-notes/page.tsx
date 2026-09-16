'use client';

// Study Notes admin page (Sept 2026, Group IV first). See
// schema.prisma's own header comment on StudyNote.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Note = {
  id: string;
  subjectId: string;
  language: 'TA' | 'EN';
  content: string;
  reviewed: boolean;
  generatedAt: string;
  subject: { name: string; sortOrder: number };
};

export default function StudyNotesAdminPage() {
  const [subCategoryOptions, setSubCategoryOptions] = useState<{ id: string; label: string }[]>([]);
  const [subCategoryId, setSubCategoryId] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

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

  function loadNotes(id: string) {
    setLoading(true);
    adminFetch(`/admin/study-notes?subCategoryId=${id}`)
      .then((r) => r.json())
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (subCategoryId) loadNotes(subCategoryId);
  }, [subCategoryId]);

  async function generateAll() {
    if (!subCategoryId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/study-notes/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subCategoryId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to generate');
      loadNotes(subCategoryId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function regenerate(subjectId: string, language: 'TA' | 'EN') {
    setGenerating(true);
    try {
      await adminFetch(`/admin/study-notes/subjects/${subjectId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      loadNotes(subCategoryId);
    } finally {
      setGenerating(false);
    }
  }

  function startEdit(note: Note) {
    setExpandedId(note.id);
    setEditContent(note.content);
  }

  async function saveReview(noteId: string) {
    setSaving(true);
    try {
      await adminFetch(`/admin/study-notes/${noteId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      setExpandedId(null);
      loadNotes(subCategoryId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Study Notes</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 640, lineHeight: 1.6 }}>
        AI-drafted from the official syllabus content already on file (SyllabusSubject/SyllabusTopic). A note is only
        ever shown to students after an admin reviews (and optionally edits) it here — never auto-published.
      </p>

      <select
        value={subCategoryId}
        onChange={(e) => setSubCategoryId(e.target.value)}
        style={{ width: '100%', maxWidth: 480, padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 12 }}
      >
        <option value="">Select an exam…</option>
        {subCategoryOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>

      {subCategoryId && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={generateAll}
            disabled={generating}
            style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            {generating ? 'Generating…' : 'Generate All Missing Notes'}
          </button>
          {error && <p style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>{error}</p>}
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: '#64748b' }}>Loading…</p>}

      {notes.map((note) => (
        <div key={note.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>
                {note.subject.name} <span style={{ fontWeight: 400, color: '#64748b' }}>({note.language})</span>
              </p>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontWeight: 700,
                  background: note.reviewed ? '#dcfce7' : '#fef3c7',
                  color: note.reviewed ? '#166534' : '#92400e',
                }}
              >
                {note.reviewed ? '✓ Reviewed' : 'Needs Review'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => (expandedId === note.id ? setExpandedId(null) : startEdit(note))}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                {expandedId === note.id ? 'Close' : 'Review / Edit'}
              </button>
              <button
                onClick={() => regenerate(note.subjectId, note.language)}
                disabled={generating}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                Regenerate
              </button>
            </div>
          </div>

          {expandedId === note.id && (
            <div style={{ marginTop: 12 }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={14}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => saveReview(note.id)}
                disabled={saving}
                style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, background: '#166534', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {saving ? 'Saving…' : '✓ Approve & Publish'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
