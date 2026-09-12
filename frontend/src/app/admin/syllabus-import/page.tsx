'use client';

// Syllabus PDF Import (Sept 2026) — admin uploads an official syllabus
// PDF, the backend extracts + AI-structures it into a DRAFT, and this
// page lets the admin review/edit every field before anything is saved
// to the real Syllabus Subject/Topic tables. Nothing here is applied
// automatically — extract() only returns a draft, applyDraft() only
// runs when the admin explicitly clicks Approve & Save.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type SubCategoryOption = { id: string; label: string };

type DraftTopic = { name: string; nameTa: string | null; description: string | null };
type DraftSubject = { name: string; nameTa: string | null; topics: DraftTopic[] };
type SyllabusDraft = { subjects: DraftSubject[]; eligibilityStandard: string | null };

export default function SyllabusImportPage() {
  const [options, setOptions] = useState<SubCategoryOption[]>([]);
  const [subCategoryId, setSubCategoryId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<SyllabusDraft | null>(null);
  const [savedResult, setSavedResult] = useState<{ subjectsCreated: number; topicsCreated: number } | null>(null);

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

      const res = await adminFetch('/admin/syllabus-import/extract', {
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

  function updateSubject(subjectIndex: number, patch: Partial<DraftSubject>) {
    if (!draft) return;
    const subjects = [...draft.subjects];
    subjects[subjectIndex] = { ...subjects[subjectIndex], ...patch };
    setDraft({ ...draft, subjects });
  }

  function updateTopic(subjectIndex: number, topicIndex: number, patch: Partial<DraftTopic>) {
    if (!draft) return;
    const subjects = [...draft.subjects];
    const topics = [...subjects[subjectIndex].topics];
    topics[topicIndex] = { ...topics[topicIndex], ...patch };
    subjects[subjectIndex] = { ...subjects[subjectIndex], topics };
    setDraft({ ...draft, subjects });
  }

  function removeTopic(subjectIndex: number, topicIndex: number) {
    if (!draft) return;
    const subjects = [...draft.subjects];
    subjects[subjectIndex] = { ...subjects[subjectIndex], topics: subjects[subjectIndex].topics.filter((_, i) => i !== topicIndex) };
    setDraft({ ...draft, subjects });
  }

  function removeSubject(subjectIndex: number) {
    if (!draft) return;
    setDraft({ ...draft, subjects: draft.subjects.filter((_, i) => i !== subjectIndex) });
  }

  async function approveAndSave() {
    if (!draft || !pdfUrl || !subCategoryId) return;
    setApplying(true);
    setError(null);
    try {
      const res = await adminFetch('/admin/syllabus-import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subCategoryId, draft, pdfUrl }),
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

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Syllabus PDF Import</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16, maxWidth: 680, lineHeight: 1.6 }}>
        Upload an official syllabus PDF — it gets AI-structured into Subject → Topic below for your review. Edit anything
        that needs fixing, remove anything wrong, then Approve &amp; Save. Nothing is saved to the real syllabus until you approve.
        Unit-wise question counts are deliberately not extracted — official syllabi call that distribution &quot;indicative only&quot;.
      </p>

      <select
        value={subCategoryId}
        onChange={(e) => setSubCategoryId(e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 12, minWidth: 320, display: 'block' }}
      >
        <option value="">Select the exam this syllabus belongs to…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
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
          ✅ Saved: {savedResult.subjectsCreated} subject(s), {savedResult.topicsCreated} topic(s).
        </div>
      )}

      {draft && (
        <div style={{ maxWidth: 720 }}>
          {draft.eligibilityStandard && (
            <p style={{ fontSize: 12, color: '#475569', marginBottom: 16 }}>
              Detected eligibility standard: <strong>{draft.eligibilityStandard}</strong> (will be saved as a verified ELIGIBILITY fact)
            </p>
          )}

          {draft.subjects.map((subject, si) => (
            <div key={si} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={subject.name}
                  onChange={(e) => updateSubject(si, { name: e.target.value })}
                  placeholder="Subject name (English)"
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', fontWeight: 600 }}
                />
                <input
                  value={subject.nameTa ?? ''}
                  onChange={(e) => updateSubject(si, { nameTa: e.target.value || null })}
                  placeholder="Subject name (Tamil)"
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
                <button onClick={() => removeSubject(si)} style={{ padding: '0 10px', borderRadius: 6, border: '1px solid #b91c1c', color: '#b91c1c', background: '#fff', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>

              {subject.topics.map((topic, ti) => (
                <div key={ti} style={{ marginLeft: 16, marginBottom: 10, padding: 10, borderRadius: 8, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <input
                      value={topic.name}
                      onChange={(e) => updateTopic(si, ti, { name: e.target.value })}
                      placeholder="Topic name (English)"
                      style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                    <input
                      value={topic.nameTa ?? ''}
                      onChange={(e) => updateTopic(si, ti, { nameTa: e.target.value || null })}
                      placeholder="Topic name (Tamil)"
                      style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                    />
                    <button onClick={() => removeTopic(si, ti)} style={{ padding: '0 8px', borderRadius: 6, border: '1px solid #94a3b8', color: '#64748b', background: '#fff', cursor: 'pointer', fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={topic.description ?? ''}
                    onChange={(e) => updateTopic(si, ti, { description: e.target.value || null })}
                    placeholder="Detailed description (optional)"
                    rows={2}
                    style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, color: '#475569', resize: 'vertical' }}
                  />
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={approveAndSave}
            disabled={applying || !subCategoryId}
            style={{ padding: '12px 24px', borderRadius: 8, background: '#166534', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {applying ? 'Saving…' : !subCategoryId ? 'Select an exam above first' : 'Approve & Save'}
          </button>

          {/* Sept 2026 — duplicated here (not just at the top of the
              page) so feedback is visible without scrolling back up —
              this form can be very long (many subjects/topics), and the
              button is at the bottom. */}
          {error && <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{error}</p>}
          {savedResult && (
            <div style={{ padding: 14, borderRadius: 8, background: '#DCFCE7', color: '#166534', fontSize: 13, marginTop: 12 }}>
              ✅ Saved: {savedResult.subjectsCreated} subject(s), {savedResult.topicsCreated} topic(s).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
