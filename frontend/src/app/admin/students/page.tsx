'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Student & Performance Management — implements §7.5: view student
// statistics and platform-wide aggregate stats. Read-only by design — this
// screen is for visibility, not for editing a student's own data.

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  activePlan: string;
  createdAt: string;
  performance: Record<string, { questionsAnswered: number; averagePercent: number; rank: number | null }>;
};

type PlatformStats = {
  totalStudents: number;
  activeSubscriptions: number;
  totalSessionsCompleted: number;
  totalQuestionsAnswered: number;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [search, setSearch] = useState('');

  async function load() {
    const [studentsRes, statsRes] = await Promise.all([
      adminFetch(`/admin/students${search ? `?search=${encodeURIComponent(search)}` : ''}`),
      adminFetch('/admin/platform-stats'),
    ]);
    const data = await studentsRes.json();
    setStudents(data.items ?? []);
    setStats(await statsRes.json());
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Students</h1>

      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <Stat label="Total Students" value={stats.totalStudents} />
          <Stat label="Active Paid Subscriptions" value={stats.activeSubscriptions} />
          <Stat label="Sessions Completed" value={stats.totalSessionsCompleted} />
          <Stat label="Questions Answered (all-time)" value={stats.totalQuestionsAnswered} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 400 }}>
        <input
          placeholder="Search by name, phone, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button onClick={load} style={{ padding: '8px 16px', borderRadius: 6 }}>Search</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
            <th style={{ padding: 10 }}>Student</th>
            <th style={{ padding: 10 }}>Plan</th>
            <th style={{ padding: 10 }}>Overall Avg %</th>
            <th style={{ padding: 10 }}>Questions Answered</th>
            <th style={{ padding: 10 }}>Rank</th>
            <th style={{ padding: 10 }}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const overall = s.performance['OVERALL'];
            return (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 10 }}>
                  <a href={`/admin/students/${s.id}`} style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
                    {s.name ?? s.phone ?? s.email ?? s.id.slice(0, 8)}
                  </a>
                </td>
                <td style={{ padding: 10 }}>{s.activePlan}</td>
                <td style={{ padding: 10 }}>{overall ? `${overall.averagePercent.toFixed(1)}%` : '—'}</td>
                <td style={{ padding: 10 }}>{overall?.questionsAnswered ?? 0}</td>
                <td style={{ padding: 10 }}>{overall?.rank ?? '—'}</td>
                <td style={{ padding: 10, color: '#94a3b8' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            );
          })}
          {students.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No students found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 18px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  );
}
