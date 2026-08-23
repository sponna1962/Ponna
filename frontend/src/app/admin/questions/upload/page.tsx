'use client';

import { useState } from 'react';
import { adminFetch } from '../../../../lib/admin-fetch';

// Bulk Upload — implements §6.3/§7.1: CSV upload, per-row validation and
// duplicate-detection report shown right after upload.

type RowResult =
  | { rowNumber: number; status: 'inserted'; questionId: string }
  | { rowNumber: number; status: 'duplicate'; existingQuestionId?: string; reason: string }
  | { rowNumber: number; status: 'invalid'; reason: string };

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ summary: any; results: RowResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

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
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, maxWidth: 560 }}>
        CSV columns required: <code>question, option_a, option_b, option_c, option_d, correct_answer</code>.
        Optional: <code>exam_type, exam_sub_type, language</code> (ta/en, defaults to ta).
        Uploaded questions land as Draft and go through AI classification before publishing.
      </p>

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
                <th style={{ padding: 8 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {result.results.map((r) => (
                <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{r.rowNumber}</td>
                  <td style={{ padding: 8, color: r.status === 'inserted' ? '#16a34a' : r.status === 'duplicate' ? '#d97706' : '#dc2626' }}>
                    {r.status}
                  </td>
                  <td style={{ padding: 8, color: '#64748b' }}>
                    {r.status === 'inserted' ? r.questionId : r.reason}
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
