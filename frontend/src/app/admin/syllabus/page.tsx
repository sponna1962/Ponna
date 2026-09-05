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

      {selectedExamId && <ExamFactsSection examId={selectedExamId} />}
      {selectedExamId && <CutoffSection examId={selectedExamId} />}
    </div>
  );
}

// ── Verified Exam Facts (finalized requirement — Ask Ponna's Exam
// Preparation Coach flow reads from this, never from AI memory) ────────
type FactType = 'APPLICATION_START_DATE' | 'APPLICATION_END_DATE' | 'EXAM_DATE' | 'EXAM_PATTERN' | 'ELIGIBILITY' | 'IMPORTANT_NOTE' | 'OTHER';
type ExamFact = { id: string; factType: FactType; value: string; sourceUrl: string | null; verifiedAt: string };

const FACT_TYPE_LABELS: Record<FactType, string> = {
  APPLICATION_START_DATE: 'Application Start Date',
  APPLICATION_END_DATE: 'Application Last Date',
  EXAM_DATE: 'Exam Date',
  EXAM_PATTERN: 'Exam Pattern / Paper Structure',
  ELIGIBILITY: 'Eligibility',
  IMPORTANT_NOTE: 'Important Note',
  OTHER: 'Other',
};

function ExamFactsSection({ examId }: { examId: string }) {
  const [facts, setFacts] = useState<ExamFact[]>([]);
  const [factType, setFactType] = useState<FactType>('EXAM_DATE');
  const [value, setValue] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));

  function load() {
    adminFetch(`/admin/exam-facts/${examId}`).then((r) => r.json()).then(setFacts);
  }

  useEffect(load, [examId]);

  async function addFact() {
    if (!value.trim()) return;
    await adminFetch(`/admin/exam-facts/${examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factType, value, sourceUrl, verifiedAt }),
    });
    setValue('');
    setSourceUrl('');
    load();
  }

  async function deleteFact(id: string) {
    if (!confirm('Delete this verified fact?')) return;
    await adminFetch(`/admin/exam-facts/${id}`, { method: 'DELETE' });
    load();
  }

  const daysSinceVerified = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Verified Exam Information</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        What Ask Ponna's Exam Coach reads for schedule/dates/pattern/eligibility — always source and verification-date stamped, never from the AI's own memory.
      </p>

      {facts.map((f) => {
        const stale = daysSinceVerified(f.verifiedAt) > 90;
        return (
          <div key={f.id} style={{ border: `1px solid ${stale ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                  {FACT_TYPE_LABELS[f.factType]}
                </span>
                <p style={{ fontSize: 14, margin: '6px 0 4px' }}>{f.value}</p>
                <p style={{ fontSize: 11, color: stale ? '#dc2626' : '#94a3b8' }}>
                  Verified {new Date(f.verifiedAt).toLocaleDateString()} {stale && '— over 90 days old, please re-check'}
                  {f.sourceUrl && (
                    <>
                      {' · '}
                      <a href={f.sourceUrl} target="_blank" rel="noreferrer">
                        source
                      </a>
                    </>
                  )}
                </p>
              </div>
              <button onClick={() => deleteFact(f.id)} style={{ fontSize: 11, color: '#dc2626' }}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
      {facts.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>No verified facts on file for this exam yet.</p>}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 12 }}>
        <select value={factType} onChange={(e) => setFactType(e.target.value as FactType)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, width: '100%' }}>
          {Object.entries(FACT_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="The fact itself, e.g. 'Group IV Mains exam scheduled for 12 October 2026'"
          rows={2}
          style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (tnpsc.gov.in link)"
            style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
          <input
            type="date"
            value={verifiedAt}
            onChange={(e) => setVerifiedAt(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
        </div>
        <button onClick={addFact} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
          + Add Verified Fact
        </button>
      </div>
    </div>
  );
}

// ── Cut-off Marks Predictor — admin management (finalized requirement,
// ₹999 Annual Plan value-add). Same verify-don't-guess, source+date
// stamped discipline as Verified Exam Facts -- real historical TNPSC
// cut-offs entered here from the official published notification, never
// guessed or seeded automatically.
type Community = 'OC' | 'BC' | 'BCM' | 'MBC_DNC' | 'SC' | 'SCA' | 'ST';
type CutoffRecordRow = { id: string; year: number; community: Community; cutoffMarks: number; totalMarks: number | null; sourceUrl: string | null; verifiedAt: string };

const COMMUNITIES: Community[] = ['OC', 'BC', 'BCM', 'MBC_DNC', 'SC', 'SCA', 'ST'];

function CutoffSection({ examId }: { examId: string }) {
  const [records, setRecords] = useState<CutoffRecordRow[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [community, setCommunity] = useState<Community>('OC');
  const [cutoffMarks, setCutoffMarks] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));

  function load() {
    adminFetch(`/admin/cutoffs/${examId}`).then((r) => r.json()).then(setRecords);
  }

  useEffect(load, [examId]);

  async function addRecord() {
    if (!cutoffMarks.trim()) return;
    await adminFetch(`/admin/cutoffs/${examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year,
        community,
        cutoffMarks: parseFloat(cutoffMarks),
        totalMarks: totalMarks.trim() ? parseFloat(totalMarks) : undefined,
        sourceUrl,
        verifiedAt,
      }),
    });
    setCutoffMarks('');
    setTotalMarks('');
    setSourceUrl('');
    load();
  }

  async function deleteRecord(id: string) {
    if (!confirm('Delete this cut-off record?')) return;
    await adminFetch(`/admin/cutoffs/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Cut-off Marks (Predictor)</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Real historical cut-off marks, community-wise, from the official TNPSC notification. Never guessed.
      </p>

      {records.map((r) => (
        <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
              {r.year} · {r.community}
            </span>
            <p style={{ fontSize: 16, fontWeight: 700, margin: '6px 0 4px' }}>
              {r.cutoffMarks}
              {r.totalMarks ? ` / ${r.totalMarks}` : ''}
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8' }}>
              Verified {new Date(r.verifiedAt).toLocaleDateString()}
              {r.sourceUrl && (
                <>
                  {' · '}
                  <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                    source
                  </a>
                </>
              )}
            </p>
          </div>
          <button onClick={() => deleteRecord(r.id)} style={{ fontSize: 11, color: '#dc2626' }}>
            Delete
          </button>
        </div>
      ))}
      {records.length === 0 && <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>No cut-off records on file for this exam yet.</p>}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            placeholder="Year"
            style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
          <select value={community} onChange={(e) => setCommunity(e.target.value as Community)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}>
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={cutoffMarks}
            onChange={(e) => setCutoffMarks(e.target.value)}
            placeholder="Cut-off marks"
            style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
          <input
            type="number"
            value={totalMarks}
            onChange={(e) => setTotalMarks(e.target.value)}
            placeholder="Total (optional)"
            style={{ width: 110, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (tnpsc.gov.in link)"
            style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
          <input
            type="date"
            value={verifiedAt}
            onChange={(e) => setVerifiedAt(e.target.value)}
            style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
        </div>
        <button onClick={addRecord} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
          + Add Cut-off Record
        </button>
      </div>
    </div>
  );
}
