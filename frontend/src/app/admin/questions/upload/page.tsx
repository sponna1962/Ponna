'use client';

import { useState } from 'react';
import { adminFetch } from '../../../../lib/admin-fetch';

// Bulk Upload — implements §6.3/§7.1: CSV upload, per-row validation and
// duplicate-detection report shown right after upload. Also asks the admin
// once, before uploading, which exam/year this whole file is for — so a
// single-exam CSV doesn't need to repeat that on every row (see
// BatchDefaults in bulk-upload.service.ts). Per-row exam_type/exam_sub_type/
// exam_year columns in the CSV still take priority if present.

type RowResult =
  | { rowNumber: number; status: 'inserted'; questionId: string; questionText: string; note?: string }
  | { rowNumber: number; status: 'duplicate'; existingQuestionId?: string; reason: string }
  | { rowNumber: number; status: 'invalid'; reason: string };

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [examType, setExamType] = useState('');
  const [examSubType, setExamSubType] = useState('');
  const [examYear, setExamYear] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ summary: any; results: RowResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    if (examType.trim()) formData.append('exam_type', examType.trim());
    if (examSubType.trim()) formData.append('exam_sub_type', examSubType.trim());
    if (examYear.trim()) formData.append('exam_year', examYear.trim());

    try {
      const res = await adminFetch('/admin/questions/bulk-upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Upload failed');
        return;
      }
      setResult(await res.json());
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Bulk Upload</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 8, maxWidth: 640 }}>
        <strong>Format A (single language):</strong> <code>question, option_a, option_b, option_c, option_d, correct_answer</code>.
        The missing language is generated automatically in the background (AI translation) as a linked Draft — review it before publishing.
      </p>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 640 }}>
        <strong>Format B (bilingual — no AI translation needed):</strong> <code>question_ta, question_en, option_a_ta, option_a_en, option_b_ta, option_b_en, option_c_ta, option_c_en, option_d_ta, option_d_en, correct_answer</code>.
        Use this when your source already has both languages (e.g. a bilingual exam paper) — both rows are inserted directly, linked, no translation step.
      </p>

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, maxWidth: 480 }}>
        <h2 style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
          This exam/year applies to the whole file below (skip this if your CSV already has its own exam_type/exam_sub_type/exam_year columns per row)
        </h2>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Exam Type</label>
        <input
          value={examType}
          onChange={(e) => setExamType(e.target.value)}
          placeholder="e.g. TET, TNPSC"
          style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Exam Sub-Type</label>
        <input
          value={examSubType}
          onChange={(e) => setExamSubType(e.target.value)}
          placeholder="e.g. Education (Paper 617), Group 4"
          style={{ width: '100%', padding: 8, marginBottom: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Exam Year (admin-only metadata)</label>
        <input
          type="number"
          value={examYear}
          onChange={(e) => setExamYear(e.target.value)}
          placeholder="e.g. 2024"
          style={{ width: 120, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
      </div>

      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ marginBottom: 12 }} />
      <br />
      <button
        onClick={upload}
        disabled={!file || uploading}
        style={{ padding: '8px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>

      {error && <p style={{ color: '#dc2626', marginTop: 12, fontSize: 13 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <Stat label="Inserted" value={result.summary.inserted} color="#16a34a" />
            <Stat label="Duplicates" value={result.summary.duplicates} color="#d97706" />
            <Stat label="Invalid" value={result.summary.invalid} color="#dc2626" />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: 8 }}>Row</th>
                <th style={{ padding: 8 }}>Status</th>
                <th style={{ padding: 8 }}>Question</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{r.rowNumber}</td>
                  <td style={{ padding: 8, color: r.status === 'inserted' ? '#16a34a' : r.status === 'duplicate' ? '#d97706' : '#dc2626' }}>
                    {r.status}
                  </td>
                  <td style={{ padding: 8, color: '#334155', maxWidth: 480 }}>
                    {r.status === 'inserted' ? (
                      <>
                        {r.questionText}
                        {r.note && <div style={{ color: '#d97706', fontSize: 11, marginTop: 2 }}>{r.note}</div>}
                      </>
                    ) : (
                      <span style={{ color: '#64748b' }}>{r.reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
