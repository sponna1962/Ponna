'use client';

// Exam Pattern Import (Sept 2026) — same review-before-apply idea as
// Syllabus PDF Import, for a "Scheme of Examination" style PDF that
// lists MANY exams' paper patterns at once. Unlike Syllabus PDF Import
// (one exam per upload, one Sub-Category picker), each extracted exam
// here needs its OWN Sub-Category match — the AI never guesses this
// mapping, so every exam starts unmatched (a dropdown) and any exam
// left unmatched is simply skipped on Approve & Save, never blocking
// the rest.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type SubCategoryOption = { id: string; label: string };

type DraftPaper = {
  label: string;
  paperName: string;
  standard: string | null;
  type: string | null;
  qualifyingOrScoring: string | null;
  questionCount: number | null;
  marks: number | null;
};
type DraftExamPattern = {
  examName: string;
  papers: DraftPaper[];
  totalQuestions: number | null;
  totalMarks: number | null;
  // Sept 2026 — an array, not a single id: some PDF rows genuinely
  // apply to several exams at once (e.g. a combined Preliminary stage
  // shared by Group IA/IB/IC/VI, even though their Main exams differ).
  // Approve & Save creates the SAME fact for every checked Sub-Category.
  subCategoryIds: string[];
};
type ExamPatternDraft = { exams: DraftExamPattern[] };

// Sept 2026 — mirrors the backend's own detectStage() (used when
// composing the saved fact text) so the admin sees the SAME stage
// distinction here, as a clear visual badge, before saving.
function detectStage(examName: string): { label: string; color: string } | null {
  if (/preliminary/i.test(examName)) return { label: 'Preliminary', color: '#2563eb' };
  if (/\bmain\b/i.test(examName)) return { label: 'Main', color: '#7c3aed' };
  if (/interview/i.test(examName)) return { label: 'Interview', color: '#ea580c' };
  return null;
}

export default function ExamPatternImportPage() {
  const [options, setOptions] = useState<SubCategoryOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExamPatternDraft | null>(null);
  const [savedResult, setSavedResult] = useState<{ factsCreated: number; skipped: number } | null>(null);

  useEffect(() => {
    adminFetch('/admin/exam-taxonomy')
      .then((r) => r.json())
      .then((tree: any[]) => {
        const flat: SubCategoryOption[] = [];
        for (const purpose of tree) {
          for (const authority of purpose.authorities ?? []) {
            for (const category of authority.categories ?? []) {
              for (const sub of category.subCategories ?? []) {
                if (sub.studentVisible === false) continue;
                flat.push({ id: sub.id, label: `${authority.name} → ${category.name} → ${sub.name}` });
              }
            }
          }
        }
        setOptions(flat);
      })
      .catch(() => setOptions([]));
  }, []);

  async function extract() {
    if (!file) return;
    setError(null);
    setExtracting(true);
    setDraft(null);
    setSavedResult(null);
    try {
      const pdfBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await adminFetch('/admin/exam-pattern-import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Extraction failed');
      }
      const data = await res.json();
      setPdfUrl(data.pdfUrl);
      setDraft(data.draft);
    } catch (err: any) {
      setError(err.message ?? 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  function updateExam(examIndex: number, patch: Partial<DraftExamPattern>) {
    if (!draft) return;
    const exams = [...draft.exams];
    exams[examIndex] = { ...exams[examIndex], ...patch };
    setDraft({ ...draft, exams });
  }

  function removeExam(examIndex: number) {
    if (!draft) return;
    setDraft({ ...draft, exams: draft.exams.filter((_, i) => i !== examIndex) });
  }

  async function approveAndSave() {
    if (!draft || !pdfUrl) return;
    setApplying(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/exam-pattern-import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, pdfUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      const result = await res.json();
      setSavedResult(result);
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
    } finally {
      setApplying(false);
    }
  }

  const matchedCount = draft?.exams.filter((e) => e.subCategoryIds.length > 0).length ?? 0;

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Exam Pattern Import</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 680, lineHeight: 1.6 }}>
        Upload an official &quot;Scheme of Examination&quot; PDF (lists many exams&apos; paper patterns at once) — it gets
        AI-extracted into a table below. Match each exam to the correct Sub-Category (unmatched exams are skipped, never
        blocking the rest), edit any wrong numbers, then Approve &amp; Save. Each matched exam becomes one verified
        PAPER_STRUCTURE fact.
      </p>

      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ marginBottom: 12, display: 'block' }} />

      <button
        onClick={extract}
        disabled={!file || extracting}
        style={{ padding: '10px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 20 }}
      >
        {extracting ? 'Extracting… (may take a minute)' : 'Extract Draft'}
      </button>

      {error && <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {savedResult && (
        <div style={{ padding: 14, borderRadius: 8, background: '#DCFCE7', color: '#166534', fontSize: 13, marginBottom: 20 }}>
          ✅ Saved {savedResult.factsCreated} exam pattern(s). {savedResult.skipped > 0 && `${savedResult.skipped} unmatched exam(s) skipped.`}
        </div>
      )}

      {draft && (
        <div style={{ maxWidth: 820 }}>
          <p style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
            {draft.exams.length} exam(s) extracted — {matchedCount} matched to a Sub-Category so far.
          </p>

          {draft.exams.map((exam, ei) => {
            const stage = detectStage(exam.examName);
            return (
            <div key={ei} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 12, background: exam.subCategoryIds.length > 0 ? '#f0fdf4' : '#fff' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                {stage && (
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff', background: stage.color, padding: '3px 10px', borderRadius: 999 }}>
                    {stage.label}
                  </span>
                )}
                <input
                  value={exam.examName}
                  onChange={(e) => updateExam(ei, { examName: e.target.value })}
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 700, fontSize: 13 }}
                />
                <button onClick={() => removeExam(ei)} style={{ padding: '0 10px', borderRadius: 6, border: '1px solid #b91c1c', color: '#b91c1c', background: '#fff', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>

              {/* Sept 2026 — checkboxes, not a single dropdown: a Preliminary-
                  stage pattern is often genuinely shared by several exams
                  at once (e.g. Group IA/IB/IC/VI). Check every Sub-Category
                  this exact pattern actually applies to. */}
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 6, padding: 8, marginBottom: 10, fontSize: 12 }}>
                {exam.subCategoryIds.length === 0 && <p style={{ color: '#94a3b8', margin: '0 0 6px' }}>Not matched — will be skipped</p>}
                {options.map((o) => (
                  <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={exam.subCategoryIds.includes(o.id)}
                      onChange={(e) =>
                        updateExam(ei, {
                          subCategoryIds: e.target.checked ? [...exam.subCategoryIds, o.id] : exam.subCategoryIds.filter((id) => id !== o.id),
                        })
                      }
                    />
                    {o.label}
                  </label>
                ))}
              </div>

              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    <th style={{ padding: 4 }}>Paper</th>
                    <th style={{ padding: 4 }}>Standard</th>
                    <th style={{ padding: 4 }}>Type</th>
                    <th style={{ padding: 4 }}>Qual/Scoring</th>
                    <th style={{ padding: 4 }}>Questions</th>
                    <th style={{ padding: 4 }}>Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {exam.papers.map((p, pi) => (
                    <tr key={pi} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: 4 }}>
                        {p.label} - {p.paperName}
                      </td>
                      <td style={{ padding: 4 }}>{p.standard ?? '—'}</td>
                      <td style={{ padding: 4 }}>{p.type ?? '—'}</td>
                      <td style={{ padding: 4 }}>{p.qualifyingOrScoring ?? '—'}</td>
                      <td style={{ padding: 4 }}>{p.questionCount ?? '—'}</td>
                      <td style={{ padding: 4 }}>{p.marks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                Total: {exam.totalQuestions ?? '—'} Questions, {exam.totalMarks ?? '—'} Marks
              </p>
            </div>
            );
          })}

          <button
            onClick={approveAndSave}
            disabled={applying || matchedCount === 0}
            style={{ padding: '12px 24px', borderRadius: 8, background: '#166534', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {applying ? 'Saving…' : matchedCount === 0 ? 'Match at least one exam first' : `Approve & Save (${matchedCount})`}
          </button>

          {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>}
          {savedResult && (
            <div style={{ padding: 14, borderRadius: 8, background: '#DCFCE7', color: '#166534', fontSize: 13, marginTop: 12 }}>
              ✅ Saved {savedResult.factsCreated} exam pattern(s). {savedResult.skipped > 0 && `${savedResult.skipped} unmatched exam(s) skipped.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
