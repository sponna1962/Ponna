'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminFetch } from '../../../../lib/admin-fetch';

// Question Bank Stats — how many questions exist per Authority → Category →
// Sub-Category, broken down by status (Published/Draft/Disabled), plus a
// bar chart of totals per Authority. Read-only dashboard; no dependency on
// a charting library — the bar chart is plain CSS so this page can never
// fail to build over a package issue.

type StatsRow = {
  authorityName: string;
  purposeName: string;
  categoryName: string;
  subCategoryName: string;
  published: number;
  draft: number;
  disabled: number;
  total: number;
};

type Stats = {
  rows: StatsRow[];
  grandTotal: { published: number; draft: number; disabled: number; total: number };
  authorityTotals: { name: string; total: number }[];
};

export default function QuestionBankStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/admin/questions/stats')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  const maxAuthorityTotal = stats ? Math.max(1, ...stats.authorityTotals.map((a) => a.total)) : 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>Question Bank Stats</h1>
        <Link href="/admin/questions" style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 14, textDecoration: 'none' }}>
          ← Back to Questions
        </Link>
      </div>

      {loading && <p style={{ color: '#64748b' }}>Loading…</p>}

      {!loading && stats && stats.rows.length === 0 && (
        <p style={{ color: '#94a3b8' }}>No questions uploaded yet.</p>
      )}

      {!loading && stats && stats.rows.length > 0 && (
        <>
          {/* Grand total summary cards */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            <StatCard label="மொத்தம் (Total)" value={stats.grandTotal.total} color="#0f172a" />
            <StatCard label="Published" value={stats.grandTotal.published} color="#16a34a" />
            <StatCard label="Draft" value={stats.grandTotal.draft} color="#64748b" />
            <StatCard label="Disabled" value={stats.grandTotal.disabled} color="#dc2626" />
          </div>

          {/* Bar chart — total questions per Exam Authority */}
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Exam Authority வாரியாக (Bar Chart)</h2>
          <div style={{ marginBottom: 32, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
            {stats.authorityTotals.map((a) => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 140, fontSize: 13, color: '#334155', textAlign: 'right', flexShrink: 0 }}>{a.name}</div>
                <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(a.total / maxAuthorityTotal) * 100}%`,
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 4,
                      minWidth: 28,
                      textAlign: 'right',
                      boxSizing: 'border-box',
                    }}
                  >
                    {a.total}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed table — Authority → Category → Sub-Category breakdown */}
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>விரிவான பட்டியல் (Detailed Table)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                <th style={{ padding: 10 }}>Exam Authority</th>
                <th style={{ padding: 10 }}>Category</th>
                <th style={{ padding: 10 }}>Sub-Category</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Published</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Draft</th>
                <th style={{ padding: 10, textAlign: 'right' }}>Disabled</th>
                <th style={{ padding: 10, textAlign: 'right' }}>மொத்தம்</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 10 }}>{r.authorityName}</td>
                  <td style={{ padding: 10, color: '#64748b' }}>{r.categoryName}</td>
                  <td style={{ padding: 10, color: '#64748b' }}>{r.subCategoryName}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>{r.published}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: '#64748b' }}>{r.draft}</td>
                  <td style={{ padding: 10, textAlign: 'right', color: '#dc2626' }}>{r.disabled}</td>
                  <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{r.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700, background: '#f8fafc' }}>
                <td style={{ padding: 10 }} colSpan={3}>
                  மொத்தம் (Grand Total)
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>{stats.grandTotal.published}</td>
                <td style={{ padding: 10, textAlign: 'right', color: '#64748b' }}>{stats.grandTotal.draft}</td>
                <td style={{ padding: 10, textAlign: 'right', color: '#dc2626' }}>{stats.grandTotal.disabled}</td>
                <td style={{ padding: 10, textAlign: 'right' }}>{stats.grandTotal.total}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 24px', minWidth: 140 }}>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
