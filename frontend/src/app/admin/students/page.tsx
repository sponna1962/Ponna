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
  isTestAccount: boolean;
  flaggedSuspicious: boolean;
  flaggedReason: string | null;
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

  async function toggleTestAccount(id: string, current: boolean) {
    const res = await adminFetch(`/admin/students/${id}/test-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTestAccount: !current }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`);
      return;
    }
    load();
  }

  async function clearSuspiciousFlag(id: string) {
    const res = await adminFetch(`/admin/students/${id}/clear-suspicious-flag`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`);
      return;
    }
    load();
  }

  /** Super Admin only — changes the phone number on an EXISTING account,
   * keeping its history/data. Bypasses OTP verification of the new
   * number, so this is a deliberate admin override — confirm() guards
   * against an accidental click. */
  async function changePhone(id: string, currentPhone: string | null) {
    const newPhone = prompt(`Enter the new phone number to link to this account (currently: ${currentPhone ?? 'none'}):`);
    if (!newPhone?.trim()) return;
    if (!confirm(`Change this account's phone number to ${newPhone.trim()}? This keeps all its history/data — only the linked number changes.`)) return;
    const res = await adminFetch(`/admin/students/${id}/change-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPhone: newPhone.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`);
      return;
    }
    load();
  }

  /** Super Admin only — permanently deletes the account and everything
   * tied to it. Irreversible, so this asks the admin to type the exact
   * account identifier back before proceeding, not just a yes/no click. */
  async function deleteStudent(id: string, label: string) {
    const typed = prompt(`This permanently deletes "${label}" and ALL its data (subscriptions, quiz history, Daily Quiz attempts, everything) — this cannot be undone.\n\nType the account's name/phone/email exactly to confirm:`);
    if (typed?.trim() !== label) {
      if (typed !== null) alert('Did not match — nothing was deleted.');
      return;
    }
    const res = await adminFetch(`/admin/students/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can delete accounts'}`);
      return;
    }
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Students</h1>

      {stats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <Stat label="Total Students" value={stats.totalStudents} />
          <Stat label="Active Paid Subscriptions" value={stats.activeSubscriptions} />
          <Stat label="Sessions Completed" value={stats.totalSessionsCompleted} />
          <Stat label="Questions Answered (all-time)" value={stats.totalQuestionsAnswered} />
          <Stat label="Flagged for Review" value={students.filter((s) => s.flaggedSuspicious).length} highlight />
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
            <th style={{ padding: 10 }}>Test Account</th>
            <th style={{ padding: 10 }}>Suspicious</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const overall = s.performance['OVERALL'];
            return (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: s.flaggedSuspicious ? '#fef2f2' : undefined }}>
                <td style={{ padding: 10 }}>
                  <a href={`/admin/students/${s.id}`} style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
                    {s.name ?? s.phone ?? s.email ?? s.id.slice(0, 8)}
                  </a>
                  {s.isTestAccount && <span style={{ marginLeft: 6, fontSize: 11, color: '#d97706' }}>🧪 TEST</span>}
                </td>
                <td style={{ padding: 10 }}>{s.activePlan}</td>
                <td style={{ padding: 10 }}>{overall ? `${overall.averagePercent.toFixed(1)}%` : '—'}</td>
                <td style={{ padding: 10 }}>{overall?.questionsAnswered ?? 0}</td>
                <td style={{ padding: 10 }}>{overall?.rank ?? '—'}</td>
                <td style={{ padding: 10, color: '#94a3b8' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: 10 }}>
                  <button onClick={() => toggleTestAccount(s.id, s.isTestAccount)} style={{ fontSize: 12, padding: '4px 10px', marginRight: 6 }}>
                    {s.isTestAccount ? 'Unmark' : 'Mark as Test'}
                  </button>
                  <button onClick={() => changePhone(s.id, s.phone)} style={{ fontSize: 12, padding: '4px 10px', marginRight: 6 }}>
                    Change Phone
                  </button>
                  <button
                    onClick={() => deleteStudent(s.id, s.name ?? s.phone ?? s.email ?? s.id)}
                    style={{ fontSize: 12, padding: '4px 10px', color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    Delete
                  </button>
                </td>
                <td style={{ padding: 10 }}>
                  {s.flaggedSuspicious ? (
                    <div>
                      <div style={{ fontSize: 11, color: '#991b1b', marginBottom: 4, maxWidth: 220 }}>🚩 {s.flaggedReason}</div>
                      <button onClick={() => clearSuspiciousFlag(s.id)} style={{ fontSize: 12, padding: '4px 10px' }}>
                        Clear Flag
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {students.length === 0 && (
            <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No students found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${highlight && value > 0 ? '#fecaca' : '#e2e8f0'}`, borderRadius: 8, padding: '10px 18px' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: highlight && value > 0 ? '#991b1b' : '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
    </div>
  );
}
