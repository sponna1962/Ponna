'use client';

// Admin: TNPSC Subject & Topic Preference — Master Structure (finalized
// requirement). Pick one TNPSC exam (Group I, Group IV, etc. — the
// existing ExamSubCategory rows), then manage its own independent
// Subject -> Topic tree. Purely master-data management for now — no
// student-facing preference/allocation wiring yet.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Exam = { id: string; name: string; _count: { syllabusSubjects: number } };
type Topic = { id: string; name: string };
type Subject = { id: string; name: string; topics: Topic[] };

export default function SyllabusPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newTopicText, setNewTopicText] = useState<Record<string, string>>({});

  useEffect(() => {
    adminFetch('/admin/syllabus/exams')
      .then((r) => r.json())
      .then((data: Exam[]) => {
        setExams(data);
        if (data.length > 0) setSelectedExamId(data[0].id);
      });
  }, []);

  function loadSyllabus(examId: string) {
    if (!examId) return;
    adminFetch(`/admin/syllabus/${examId}`)
      .then((r) => r.json())
      .then(setSubjects);
  }

  useEffect(() => {
    loadSyllabus(selectedExamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  async function addSubject() {
    if (!newSubjectName.trim() || !selectedExamId) return;
    await adminFetch(`/admin/syllabus/${selectedExamId}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSubjectName.trim() }),
    });
    setNewSubjectName('');
    loadSyllabus(selectedExamId);
  }

  async function deleteSubject(id: string) {
    if (!confirm('Delete this subject and all its topics?')) return;
    await adminFetch(`/admin/syllabus/subjects/${id}`, { method: 'DELETE' });
    loadSyllabus(selectedExamId);
  }

  /** Accepts one topic per line, pasted in bulk — the practical way to
   * enter a real syllabus quickly rather than one Add click per topic. */
  async function addTopics(subjectId: string) {
    const text = newTopicText[subjectId];
    if (!text?.trim()) return;
    const names = text.split('\n').map((n) => n.trim()).filter(Boolean);
    await adminFetch(`/admin/syllabus/subjects/${subjectId}/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names }),
    });
    setNewTopicText((prev) => ({ ...prev, [subjectId]: '' }));
    loadSyllabus(selectedExamId);
  }

  async function deleteTopic(id: string) {
    await adminFetch(`/admin/syllabus/topics/${id}`, { method: 'DELETE' });
    loadSyllabus(selectedExamId);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Subject &amp; Topic Preference — Master Structure</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Each TNPSC exam (Group) has its own independent Subject → Topic tree, matching its official syllabus. Master data only for now —
        not yet connected to student preferences or question allocation.
      </p>

      <label style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>
        Exam:{' '}
        <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e._count.syllabusSubjects} subjects)
            </option>
          ))}
        </select>
      </label>

      {subjects.map((s) => (
        <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 15 }}>{s.name}</strong>
            <button onClick={() => deleteSubject(s.id)} style={{ fontSize: 12, color: '#dc2626' }}>
              Delete Subject
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {s.topics.map((t) => (
              <span key={t.id} style={{ fontSize: 12, background: '#f1f5f9', padding: '4px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.name}
                <button onClick={() => deleteTopic(t.id)} style={{ fontSize: 11, color: '#94a3b8', border: 'none', background: 'none', cursor: 'pointer' }}>
                  ✕
                </button>
              </span>
            ))}
            {s.topics.length === 0 && <span style={{ fontSize: 12, color: '#94a3b8' }}>No topics yet.</span>}
          </div>

          <textarea
            value={newTopicText[s.id] ?? ''}
            onChange={(e) => setNewTopicText((prev) => ({ ...prev, [s.id]: e.target.value }))}
            placeholder="One topic per line — paste a list to add many at once"
            rows={2}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }}
          />
          <button onClick={() => addTopics(s.id)} style={{ fontSize: 12, padding: '4px 12px' }}>
            + Add Topic(s)
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newSubjectName}
          onChange={(e) => setNewSubjectName(e.target.value)}
          placeholder="New subject name (e.g. General Studies)"
          style={{ flex: 1, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button onClick={addSubject} style={{ padding: '10px 18px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
          + Add Subject
        </button>
      </div>
    </div>
  );
}
