'use client';

import { useState } from 'react';
import { adminFetch } from '../../../../lib/admin-fetch';
import { ExamTaxonomyPicker, TaxonomyValue } from '../../../../components/ExamTaxonomyPicker';

// Bulk Upload — Step 1: Source Type, Step 2: metadata (applies to the whole
// file — never repeated per row), Step 3: upload CSV → Validate → Preview →
// Confirm Import. Exact-duplicate detection only in V1; no per-row
// checkboxes — the admin reviews the summary/list, then imports every valid,
// non-duplicate row in one action.

const SOURCE_TYPES = [
  { value: 'PREVIOUS_EXAM', label: 'Previous Exam' },
  { value: 'BOOK', label: 'Book / Study Material' },
  { value: 'ORIGINAL', label: 'Original / Admin Created' },
  { value: 'OTHER', label: 'Other' },
];

type PreviewRow = {
  rowNumber: number;
  status: 'valid' | 'invalid' | 'duplicate';
  reason?: string;
  data?: any;
};

export default function BulkUploadPage() {
  const [sourceType, setSourceType] = useState('PREVIOUS_EXAM');
  const [taxonomy, setTaxonomy] = useState<TaxonomyValue>({ authorityId: '', categoryId: '', subCategoryId: '' });
  const [examName, setExamName] = useState('');
  const [examYear, setExamYear] = useState('');
  const [sourceName, setSourceName] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{ summary: any; rows: PreviewRow[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    if (!file) return;
    setPreviewing(true);
    setError(null);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await adminFetch('/admin/questions/bulk-upload/preview', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Preview failed');
        return;
      }
      setPreview(await res.json());
    } finally {
      setPreviewing(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setImporting(true);
    setError(null);
    const validRows = preview.rows.filter((r) => r.status === 'valid').map((r) => r.data);

    const batchMeta = {
      authorityId: taxonomy.authorityId || undefined,
      categoryId: taxonomy.categoryId || undefined,
      subCategoryId: taxonomy.subCategoryId || undefined,
      examName: examName.trim() || undefined,
      examYear: examYear ? Number(examYear) : undefined,
      sourceType,
      sourceName: sourceName.trim() || undefined,
    };

    try {
      const res = await adminFetch('/admin/questions/bulk-upload/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows, batchMeta }),
      });
      if (!res.ok) {
        // The server may fail before reaching our route's own JSON error
        // response (e.g. a request-size rejection) — guard the parse itself
        // so a non-JSON error body still shows something instead of the
        // click silently appearing to do nothing.
        let message = `Import failed (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // response wasn't JSON — keep the generic HTTP-status message above
        }
        setError(message);
        return;
      }
      setImportResult(await res.json());
      setPreview(null);
      setFile(null);
    } catch (err) {
      // Network failure, or the request never reached the server at all.
      setError(err instanceof Error ? err.message : 'Import failed — check your connection and try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Bulk Upload</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 640 }}>
        Set the exam metadata once below — every question in the file inherits it, so you never
        repeat the exam/year/source on every CSV row.
      </p>

      {/* Step 1 — Source Type */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, maxWidth: 560 }}>
        <h2 style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Step 1 — Source Type</h2>
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #cbd5e1', width: '100%' }}>
          {SOURCE_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Step 2 — Metadata */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, maxWidth: 640 }}>
        <h2 style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Step 2 — Exam Metadata (applies to the whole file)</h2>
        <div style={{ marginBottom: 10 }}>
          <ExamTaxonomyPicker value={taxonomy} onChange={setTaxonomy} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          <label style={{ fontSize: 13 }}>
            Exam Name (optional):{' '}
            <input value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="e.g. Assistant Public Prosecutor, Grade II" style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', minWidth: 220 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            Exam Year (optional):{' '}
            <input type="number" value={examYear} onChange={(e) => setExamYear(e.target.value)} placeholder="2024" style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }} />
          </label>
        </div>
        <label style={{ fontSize: 13, display: 'block' }}>
          Source Name (optional, admin-only):{' '}
          <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="e.g. TNPSC Group IV Question Paper 2024" style={{ padding: 6, borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', marginTop: 4 }} />
        </label>
      </div>

      {/* Step 3 — Upload */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, maxWidth: 640 }}>
        <h2 style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>Step 3 — Upload CSV</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
          Columns: <code>question_ta, question_en, option_a_ta, option_a_en, option_b_ta, option_b_en, option_c_ta, option_c_en, option_d_ta, option_d_en, correct_answer</code>.
          A row needs at least one language fully filled in — the other is generated automatically after import if missing.
        </p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ marginBottom: 12 }} />
        <br />
        <button onClick={runPreview} disabled={!file || previewing} style={{ padding: '8px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
          {previewing ? 'Validating…' : 'Validate & Preview'}
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 13 }}>{error}</p>}

      {importResult && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: 16, marginBottom: 16, maxWidth: 640 }}>
          <strong>Imported {importResult.inserted} question(s) as Draft.</strong> They'll go through AI difficulty
          classification shortly — check the Needs Review queue or the Questions list.
        </div>
      )}

      {preview && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Stat label="Total" value={preview.summary.total} color="#334155" />
            <Stat label="Valid" value={preview.summary.valid} color="#16a34a" />
            <Stat label="Duplicate" value={preview.summary.duplicate} color="#d97706" />
            <Stat label="Invalid" value={preview.summary.invalid} color="#dc2626" />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: 8 }}>Row</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Question / Reason</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{r.rowNumber}</td>
                  <td style={{ padding: 8, color: r.status === 'valid' ? '#16a34a' : r.status === 'duplicate' ? '#d97706' : '#dc2626' }}>{r.status}</td>
                  <td style={{ padding: 8, color: '#334155', maxWidth: 420 }}>
                    {r.status === 'valid' ? (r.data?.questionTextTa || r.data?.questionTextEn) : r.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={confirmImport}
            disabled={importing || preview.summary.valid === 0}
            style={{ padding: '10px 24px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', fontWeight: 600 }}
          >
            {importing ? 'Importing…' : `Confirm Import (${preview.summary.valid} questions)`}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 20px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  );
}
