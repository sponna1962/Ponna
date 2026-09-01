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
  authorityId?: string;
  authorityName: string;
  purposeName: string;
  categoryId?: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName: string;
  published: number;
  draft: number;
  disabled: number;
  ta: number;
  en: number;
  total: number;
};

type Stats = {
  rows: StatsRow[];
  grandTotal: { published: number; draft: number; disabled: number; ta: number; en: number; total: number };
  authorityTotals: { id?: string; name: string; total: number }[];
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

  const buildUrl = (filters: { status?: string; language?: string; authorityId?: string; categoryId?: string; subCategoryId?: string }) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.language) params.set('language', filters.language);
    if (filters.authorityId) params.set('authorityId', filters.authorityId);
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.subCategoryId) params.set('subCategoryId', filters.subCategoryId);
    const queryString = params.toString();
    return `/admin/questions${queryString ? `?${queryString}` : ''}`;
  };

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
            <StatCard label="மொத்தம் (Total)" value={stats.grandTotal.total} color="#0f172a" href={buildUrl({})} />
            <StatCard label="Published" value={stats.grandTotal.published} color="#16a34a" href={buildUrl({ status: 'PUBLISHED' })} />
            <StatCard label="Draft" value={stats.grandTotal.draft} color="#64748b" href={buildUrl({ status: 'DRAFT' })} />
            <StatCard label="Disabled" value={stats.grandTotal.disabled} color="#dc2626" href={buildUrl({ status: 'DISABLED' })} />
            <StatCard label="தமிழ் (Tamil)" value={stats.grandTotal.ta} color="#7c3aed" href={buildUrl({ language: 'TA' })} />
            <StatCard label="English" value={stats.grandTotal.en} color="#0891b2" href={buildUrl({ language: 'EN' })} />
          </div>

          {/* Bar chart — total questions per Exam Authority */}
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Exam Authority வாரியாக (Bar Chart)</h2>
          <div style={{ marginBottom: 32, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
            {stats.authorityTotals.map((a) => (
              <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 140, fontSize: 13, color: '#334155', textAlign: 'right', flexShrink: 0 }}>{a.name}</div>
                <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <Link
                    href={buildUrl({ authorityId: a.id })}
                    style={{
                      display: 'block',
                      width: `${(a.total / maxAuthorityTotal) * 100}%`,
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: 12,
                      padding: '4px 8px',
                      borderRadius: 4,
                      minWidth: 28,
                      textAlign: 'right',
                      boxSizing: 'border-box',
                      textDecoration: 'none',
                    }}
                    title={`Click to view ${a.total} questions for ${a.name}`}
                  >
                    {a.total}
                  </Link>
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
                <th style={{ padding: 10, textAlign: 'right' }}>தமிழ்</th>
                <th style={{ padding: 10, textAlign: 'right' }}>English</th>
                <th style={{ padding: 10, textAlign: 'right' }}>மொத்தம்</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r, i) => {
                const taxParams = {
                  authorityId: r.authorityId,
                  categoryId: r.categoryId,
                  subCategoryId: r.subCategoryId,
                };
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 10 }}>{r.authorityName}</td>
                    <td style={{ padding: 10, color: '#64748b' }}>{r.categoryName}</td>
                    <td style={{ padding: 10, color: '#64748b' }}>{r.subCategoryName}</td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>
                      <Link href={buildUrl({ ...taxParams, status: 'PUBLISHED' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.published}
                      </Link>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#64748b' }}>
                      <Link href={buildUrl({ ...taxParams, status: 'DRAFT' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.draft}
                      </Link>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#dc2626' }}>
                      <Link href={buildUrl({ ...taxParams, status: 'DISABLED' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.disabled}
                      </Link>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#7c3aed' }}>
                      <Link href={buildUrl({ ...taxParams, language: 'TA' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.ta}
                      </Link>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', color: '#0891b2' }}>
                      <Link href={buildUrl({ ...taxParams, language: 'EN' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.en}
                      </Link>
                    </td>
                    <td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>
                      <Link href={buildUrl({ ...taxParams })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {r.total}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #cbd5e1', fontWeight: 700, background: '#f8fafc' }}>
                <td style={{ padding: 10 }} colSpan={3}>
                  மொத்தம் (Grand Total)
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#16a34a' }}>
                  <Link href={buildUrl({ status: 'PUBLISHED' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {stats.grandTotal.published}
                  </Link>
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#64748b' }}>
                  <Link href={buildUrl({ status: 'DRAFT' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {stats.grandTotal.draft}
                  </Link>
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#dc2626' }}>
                  <Link href={buildUrl({ status: 'DISABLED' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {stats.grandTotal.disabled}
                  </Link>
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#7c3aed' }}>
                  <Link href={buildUrl({ language: 'TA' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {stats.grandTotal.ta}
                  </Link>
                </td>
                <td style={{ padding: 10, textAlign: 'right', color: '#0891b2' }}>
                  <Link href={buildUrl({ language: 'EN' })} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {stats.grandTotal.en}
                  </Link>
                </td>
                <td style={{ padding: 10, textAlign: 'right' }}>
                  <Link href={buildUrl({})} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {stats.grandTotal.total}
                  </Link>
                </td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color, href }: { label: string; value: number; color: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '16px 24px',
        minWidth: 140,
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        transition: 'transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
    </Link>
  );
}
