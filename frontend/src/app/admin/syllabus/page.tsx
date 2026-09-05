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
      {selectedExamId && <MockExamSection examId={selectedExamId} />}
      {selectedExamId && <NotificationImportSection examId={selectedExamId} />}
    </div>
  );
}

// ── Verified Exam Facts (finalized requirement — Ask Ponna's Exam
// Preparation Coach flow reads from this, never from AI memory) ────────
type FactType =
  | 'APPLICATION_START_DATE'
  | 'APPLICATION_END_DATE'
  | 'EXAM_DATE'
  | 'EXAM_PATTERN'
  | 'ELIGIBILITY'
  | 'IMPORTANT_NOTE'
  | 'OTHER'
  | 'POSTS_COVERED'
  | 'DEPARTMENT_SERVICE'
  | 'AGE_LIMIT'
  | 'AGE_RELAXATION'
  | 'EXAM_STAGES'
  | 'PAPER_STRUCTURE'
  | 'SELECTION_PROCESS'
  | 'VACANCY_COUNT'
  | 'HALL_TICKET_INFO'
  | 'ANSWER_KEY_STATUS'
  | 'RESULT_STATUS'
  | 'APPLICATION_CORRECTION_WINDOW'
  | 'RESERVATION_INFO';
type ExamFact = { id: string; factType: FactType; value: string; sourceUrl: string | null; verifiedAt: string; isOfficialConfirmed: boolean };

const FACT_TYPE_LABELS: Record<FactType, string> = {
  APPLICATION_START_DATE: 'Application Start Date',
  APPLICATION_END_DATE: 'Application Last Date',
  EXAM_DATE: 'Exam Date',
  EXAM_PATTERN: 'Exam Pattern / Paper Structure',
  ELIGIBILITY: 'Eligibility',
  IMPORTANT_NOTE: 'Important Note',
  OTHER: 'Other',
  POSTS_COVERED: 'Posts Covered',
  DEPARTMENT_SERVICE: 'Department / Service',
  AGE_LIMIT: 'Age Limit',
  AGE_RELAXATION: 'Age Relaxation',
  EXAM_STAGES: 'Exam Stages',
  PAPER_STRUCTURE: 'Paper Structure',
  SELECTION_PROCESS: 'Selection Process',
  VACANCY_COUNT: 'Vacancy Count',
  HALL_TICKET_INFO: 'Hall Ticket Info',
  ANSWER_KEY_STATUS: 'Answer Key Status',
  RESULT_STATUS: 'Result Status',
  APPLICATION_CORRECTION_WINDOW: 'Application Correction Window',
  RESERVATION_INFO: 'Reservation Info',
};

function ExamFactsSection({ examId }: { examId: string }) {
  const [facts, setFacts] = useState<ExamFact[]>([]);
  const [factType, setFactType] = useState<FactType>('EXAM_DATE');
  const [value, setValue] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [isOfficialConfirmed, setIsOfficialConfirmed] = useState(true);

  function load() {
    adminFetch(`/admin/exam-facts/${examId}`).then((r) => r.json()).then(setFacts);
  }

  useEffect(load, [examId]);

  async function addFact() {
    if (!value.trim()) return;
    await adminFetch(`/admin/exam-facts/${examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factType, value, sourceUrl, verifiedAt, isOfficialConfirmed }),
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
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    marginLeft: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    color: f.isOfficialConfirmed ? '#166534' : '#92400e',
                    background: f.isOfficialConfirmed ? '#dcfce7' : '#fef3c7',
                  }}
                >
                  {f.isOfficialConfirmed ? 'OFFICIAL' : 'TENTATIVE'}
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={isOfficialConfirmed} onChange={(e) => setIsOfficialConfirmed(e.target.checked)} />
          Officially confirmed (uncheck for a tentative/expected value)
        </label>
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
type CutoffRecordRow = { id: string; year: number; community: Community; cutoffMarks: number; totalMarks: number | null; sourceUrl: string | null; verifiedAt: string; isOfficialConfirmed: boolean };

const COMMUNITIES: Community[] = ['OC', 'BC', 'BCM', 'MBC_DNC', 'SC', 'SCA', 'ST'];

function CutoffSection({ examId }: { examId: string }) {
  const [records, setRecords] = useState<CutoffRecordRow[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [community, setCommunity] = useState<Community>('OC');
  const [cutoffMarks, setCutoffMarks] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [isOfficialConfirmed, setIsOfficialConfirmed] = useState(false);

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
        isOfficialConfirmed,
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
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                marginLeft: 6,
                padding: '2px 8px',
                borderRadius: 4,
                color: r.isOfficialConfirmed ? '#166534' : '#92400e',
                background: r.isOfficialConfirmed ? '#dcfce7' : '#fef3c7',
              }}
            >
              {r.isOfficialConfirmed ? 'OFFICIAL CUTOFF' : 'ESTIMATE / HISTORICAL'}
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 8 }}>
          <input type="checkbox" checked={isOfficialConfirmed} onChange={(e) => setIsOfficialConfirmed(e.target.checked)} />
          This is a real official cutoff (uncheck for historical/estimate data)
        </label>
        <button onClick={addRecord} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
          + Add Cut-off Record
        </button>
      </div>
    </div>
  );
}

// ── Live Exam / Mock Exam — admin configuration (finalized requirement,
// ₹999 Annual Plan value-add). Real exam pattern only — never guessed.
type MockConfig = {
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarkingFraction: number;
  sourceUrl: string | null;
  verifiedAt: string;
} | null;

function MockExamSection({ examId }: { examId: string }) {
  const [config, setConfig] = useState<MockConfig>(null);
  const [questionCount, setQuestionCount] = useState('100');
  const [durationMinutes, setDurationMinutes] = useState('180');
  const [marksPerQuestion, setMarksPerQuestion] = useState('1');
  const [negativeMarkingFraction, setNegativeMarkingFraction] = useState('0');
  const [sourceUrl, setSourceUrl] = useState('');
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));

  function load() {
    adminFetch(`/admin/mock-exam/${examId}`)
      .then((r) => r.json())
      .then((data: MockConfig) => {
        setConfig(data);
        if (data) {
          setQuestionCount(String(data.questionCount));
          setDurationMinutes(String(data.durationMinutes));
          setMarksPerQuestion(String(data.marksPerQuestion));
          setNegativeMarkingFraction(String(data.negativeMarkingFraction));
          setSourceUrl(data.sourceUrl ?? '');
          setVerifiedAt(data.verifiedAt.slice(0, 10));
        }
      });
  }

  useEffect(load, [examId]);

  async function save() {
    await adminFetch(`/admin/mock-exam/${examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionCount: parseInt(questionCount, 10),
        durationMinutes: parseInt(durationMinutes, 10),
        marksPerQuestion: parseFloat(marksPerQuestion),
        negativeMarkingFraction: parseFloat(negativeMarkingFraction),
        sourceUrl,
        verifiedAt,
      }),
    });
    load();
  }

  async function remove() {
    if (!confirm('Remove Live Exam configuration for this exam? Students will no longer be able to start it.')) return;
    await adminFetch(`/admin/mock-exam/${examId}`, { method: 'DELETE' });
    setConfig(null);
  }

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Live Exam (Full Mock Simulation)</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Real exam pattern — question count, time limit, marking scheme — verified against the official notification, never guessed.
        {config ? ' Currently configured; students can attempt this exam once.' : ' Not configured yet — Live Exam stays hidden for this exam until set up.'}
      </p>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <label style={{ flex: 1, fontSize: 12 }}>
            Question Count
            <input type="number" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }} />
          </label>
          <label style={{ flex: 1, fontSize: 12 }}>
            Duration (minutes)
            <input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <label style={{ flex: 1, fontSize: 12 }}>
            Marks / Question
            <input type="number" step="0.1" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }} />
          </label>
          <label style={{ flex: 1, fontSize: 12 }}>
            Negative Marking (fraction, e.g. 0.33 for -1/3; 0 = none)
            <input type="number" step="0.01" value={negativeMarkingFraction} onChange={(e) => setNegativeMarkingFraction(e.target.value)} style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', marginTop: 4 }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (tnpsc.gov.in exam pattern page)"
            style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
          />
          <input type="date" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} style={{ flex: 1, padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
            {config ? 'Update' : 'Save'} Configuration
          </button>
          {config && (
            <button onClick={remove} style={{ padding: '8px 16px', borderRadius: 6, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', fontSize: 13 }}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Official Data Import Workflow (Ask Ponna Master Requirement, Spec v5
// Refinement 3, BINDING). Admin pastes a notification's text; the system
// suggests candidate facts via simple pattern-matching; admin reviews,
// edits, and approves each one (or discards it) before it becomes real
// verified data. Nothing here is EVER treated as verified until
// explicitly approved -- admin approval remains the sole authority.
type ImportCandidate = { id: string; suggestedFactType: FactType; suggestedValue: string; approved: boolean };
type NotificationImportRow = { id: string; rawText: string; sourceUrl: string | null; status: 'PENDING' | 'REVIEWED'; candidates: ImportCandidate[] };

function NotificationImportSection({ examId }: { examId: string }) {
  const [rawText, setRawText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [currentImport, setCurrentImport] = useState<NotificationImportRow | null>(null);
  const [verifiedAt, setVerifiedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);

  async function createImport() {
    if (!rawText.trim()) return;
    setCreating(true);
    const res = await adminFetch(`/admin/notification-imports/${examId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, sourceUrl }),
    });
    setCreating(false);
    const data = await res.json();
    setCurrentImport(data);
    setRawText('');
  }

  async function updateCandidateValue(candidateId: string, value: string) {
    if (!currentImport) return;
    await adminFetch(`/admin/notification-import-candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestedValue: value }),
    });
    setCurrentImport({
      ...currentImport,
      candidates: currentImport.candidates.map((c) => (c.id === candidateId ? { ...c, suggestedValue: value } : c)),
    });
  }

  async function approveCandidate(candidateId: string) {
    await adminFetch(`/admin/notification-import-candidates/${candidateId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedAt }),
    });
    if (currentImport) {
      setCurrentImport({
        ...currentImport,
        candidates: currentImport.candidates.map((c) => (c.id === candidateId ? { ...c, approved: true } : c)),
      });
    }
  }

  async function discardCandidate(candidateId: string) {
    await adminFetch(`/admin/notification-import-candidates/${candidateId}`, { method: 'DELETE' });
    if (currentImport) {
      setCurrentImport({ ...currentImport, candidates: currentImport.candidates.filter((c) => c.id !== candidateId) });
    }
  }

  async function markReviewed() {
    if (!currentImport) return;
    await adminFetch(`/admin/notification-imports/${currentImport.id}/mark-reviewed`, { method: 'POST' });
    setCurrentImport(null);
  }

  return (
    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>Official Data Import</h2>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Paste an official notification's text below. The system will suggest candidate facts (pattern-matching only) -- nothing becomes real verified data until you review and approve each one individually.
      </p>

      {!currentImport && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the official notification's text here..."
            rows={6}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Source URL (the official notification link)"
            style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }}
          />
          <button onClick={createImport} disabled={creating} style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13 }}>
            {creating ? 'Analyzing…' : 'Find Candidate Facts'}
          </button>
        </div>
      )}

      {currentImport && (
        <div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            {currentImport.candidates.length === 0
              ? 'No candidates were pattern-matched from this text -- you can still add facts manually above, or discard this import.'
              : `${currentImport.candidates.filter((c) => !c.approved).length} candidate(s) awaiting review:`}
          </p>
          {currentImport.candidates.map((c) => (
            <div key={c.id} style={{ border: `1px solid ${c.approved ? '#86efac' : '#e2e8f0'}`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
                {FACT_TYPE_LABELS[c.suggestedFactType]}
              </span>
              {c.approved ? (
                <p style={{ fontSize: 13, margin: '8px 0 0', color: '#166534', fontWeight: 600 }}>✓ Approved — {c.suggestedValue}</p>
              ) : (
                <>
                  <textarea
                    value={c.suggestedValue}
                    onChange={(e) => updateCandidateValue(c.id, e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, margin: '8px 0', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveCandidate(c.id)} style={{ padding: '6px 14px', borderRadius: 6, background: '#166534', color: '#fff', border: 'none', fontSize: 12 }}>
                      Approve
                    </button>
                    <button onClick={() => discardCandidate(c.id)} style={{ padding: '6px 14px', borderRadius: 6, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', fontSize: 12 }}>
                      Discard
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <label style={{ fontSize: 12 }}>
              Verified date for approvals:
              <input type="date" value={verifiedAt} onChange={(e) => setVerifiedAt(e.target.value)} style={{ marginLeft: 6, padding: 4, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
            </label>
          </div>
          <button onClick={markReviewed} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', fontSize: 13 }}>
            Done — Mark Import Reviewed
          </button>
        </div>
      )}
    </div>
  );
}
