'use client';

// Exam Data Import (Sept 2026) — ONE simple page for three TNPSC
// multi-exam TABLE documents: Scheme of Examination, Annual Planner,
// Selection Schedule. Same {label, value} review shape regardless of
// which document type is picked, by explicit request (keep this
// simple, no confusion) -- the document-type dropdown only changes
// what the AI looks for and which fact type gets saved, not the form.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type SubCategoryOption = { id: string; label: string };
type DocumentType = 'SCHEME_OF_EXAMINATION' | 'ANNUAL_PLANNER' | 'SELECTION_SCHEDULE';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  SCHEME_OF_EXAMINATION: 'Scheme of Examination',
  ANNUAL_PLANNER: 'Annual Planner (tentative dates)',
  SELECTION_SCHEDULE: 'Selection Schedule (stage-wise dates)',
};

type DraftFact = { label: string; value: string };
type DraftExamEntry = { examName: string; facts: DraftFact[]; subCategoryIds: string[] };
type ExamDataDraft = { documentType: DocumentType; exams: DraftExamEntry[] };

function detectStage(examName: string): { label: string; color: string } | null {
  if (/preliminary/i.test(examName)) return { label: 'Preliminary', color: '#2563eb' };
  if (/\bmain\b/i.test(examName)) return { label: 'Main', color: '#7c3aed' };
  if (/interview/i.test(examName)) return { label: 'Interview', color: '#ea580c' };
  return null;
}

export default function ExamDataImportPage() {
  const [documentType, setDocumentType] = useState<DocumentType>('SCHEME_OF_EXAMINATION');
  const [options, setOptions] = useState<SubCategoryOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExamDataDraft | null>(null);
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

      const res = await adminFetch('/admin/exam-data-import/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType, pdfBase64 }),
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

  function updateExam(examIndex: number, patch: Partial<DraftExamEntry>) {
    if (!draft) return;
    const exams = [...draft.exams];
    exams[examIndex] = { ...exams[examIndex], ...patch };
    setDraft({ ...draft, exams });
  }

  function updateFact(examIndex: number, factIndex: number, patch: Partial<DraftFact>) {
    if (!draft) return;
    const facts = [...draft.exams[examIndex].facts];
    facts[factIndex] = { ...facts[factIndex], ...patch };
    updateExam(examIndex, { facts });
  }

  function removeExam(examIndex: number) {
    if (!draft) return;
    setDraft({ ...draft, exams: draft.exams.filter((_, i) => i !== examIndex) });
  }

  function removeFact(examIndex: number, factIndex: number) {
    if (!draft) return;
    updateExam(examIndex, { facts: draft.exams[examIndex].facts.filter((_, i) => i !== factIndex) });
  }

  async function approveAndSave() {
    if (!draft || !pdfUrl) return;
    setApplying(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/exam-data-import/apply', {
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
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Exam Data Import</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 680, lineHeight: 1.6 }}>
        One tool for three official TNPSC documents — pick which one below, upload the PDF, and it gets AI-extracted into a
        simple list of facts per exam. Match each exam to the correct Sub-Category (unmatched exams are skipped), edit
        anything wrong, then Approve &amp; Save.
      </p>

      <label style={{ display: 'block', fontSize: 12, color: '#475569', marginBottom: 4 }}>Document type</label>
      <select
        value={documentType}
        onChange={(e) => setDocumentType(e.target.value as DocumentType)}
        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 16, minWidth: 320, display: 'block' }}
      >
        {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((dt) => (
          <option key={dt} value={dt}>
            {DOCUMENT_TYPE_LABELS[dt]}
          </option>
        ))}
      </select>

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
          ✅ Saved {savedResult.factsCreated} fact(s). {savedResult.skipped > 0 && `${savedResult.skipped} unmatched exam(s) skipped.`}
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

                {exam.facts.map((fact, fi) => (
                  <div key={fi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input
                      value={fact.label}
                      onChange={(e) => updateFact(ei, fi, { label: e.target.value })}
                      style={{ flex: '0 0 40%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                    />
                    <input
                      value={fact.value}
                      onChange={(e) => updateFact(ei, fi, { value: e.target.value })}
                      style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }}
                    />
                    <button onClick={() => removeFact(ei, fi)} style={{ padding: '0 8px', borderRadius: 6, border: '1px solid #94a3b8', color: '#64748b', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                ))}
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
              ✅ Saved {savedResult.factsCreated} fact(s). {savedResult.skipped > 0 && `${savedResult.skipped} unmatched exam(s) skipped.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
