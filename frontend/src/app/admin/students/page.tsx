'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Student = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  cityTownVillage: string | null;
  district: string | null;
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

  async function changeName(id: string, currentName: string | null) {
    const newName = prompt(`Enter the corrected name for this account (currently: ${currentName ?? 'none'}):`);
    if (!newName?.trim()) return;
    const res = await adminFetch(`/admin/students/${id}/change-name`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName: newName.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`);
      return;
    }
    load();
  }

  async function changeEmail(id: string, currentEmail: string | null) {
    const newEmail = prompt(`Enter the new email address for this account (currently: ${currentEmail ?? 'none'}):`);
    if (!newEmail?.trim()) return;
    if (!confirm(`Change this account's email to ${newEmail.trim()}? All history/data stays — only the email changes.`)) return;
    const res = await adminFetch(`/admin/students/${id}/change-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail: newEmail.trim() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`);
      return;
    }
    load();
  }

  async function deleteStudent(id: string, label: string) {
    const typed = prompt(`This permanently deletes "${label}" and ALL its data (subscriptions, quiz history, Daily Quiz attempts, everything) — this cannot be undone.\n\nType the account's name/phone/email exactly to confirm:`);
    if (typed?.trim() !== label.trim()) {
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, maxWidth: 460 }}>
        <input
          placeholder="Search name, email, mobile, town or district"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
        />
        <button onClick={load} style={{ padding: '8px 16px', borderRadius: 6 }}>Search</button>
      </div>

      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', background: '#f8fafc' }}>
              <th style={{ padding: 12 }}>Plan</th>
              <th style={{ padding: 12 }}>Student Name</th>
              <th style={{ padding: 12 }}>Email</th>
              <th style={{ padding: 12 }}>Mobile</th>
              <th style={{ padding: 12 }}>Town / City</th>
              <th style={{ padding: 12 }}>Joined Date</th>
              <th style={{ padding: 12 }}>Admin Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: s.flaggedSuspicious ? '#fef2f2' : undefined }}>
                <td style={{ padding: 12, whiteSpace: 'nowrap' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 9px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    background: s.activePlan.toLowerCase() === 'free' ? '#f1f5f9' : '#dcfce7',
                    color: s.activePlan.toLowerCase() === 'free' ? '#475569' : '#166534',
                  }}>{s.activePlan}</span>
                  {s.isTestAccount && <div style={{ marginTop: 4, fontSize: 11, color: '#b45309' }}>🧪 TEST</div>}
                </td>
                <td style={{ padding: 12, minWidth: 140 }}>
                  <a href={`/admin/students/${s.id}`} style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'none' }}>
                    {s.name || 'Name not provided'}
                  </a>
                  {s.flaggedSuspicious && <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 4 }}>🚩 Flagged for review</div>}
                </td>
                <td style={{ padding: 12 }}>{s.email || '—'}</td>
                <td style={{ padding: 12, whiteSpace: 'nowrap' }}>{s.phone || '—'}</td>
                <td style={{ padding: 12 }}>{[s.cityTownVillage, s.district].filter(Boolean).join(', ') || '—'}</td>
                <td style={{ padding: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                <td style={{ padding: 12, minWidth: 230 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <button onClick={() => toggleTestAccount(s.id, s.isTestAccount)} style={{ fontSize: 11, padding: '4px 7px' }}>
                      {s.isTestAccount ? 'Unmark Test' : 'Mark Test'}
                    </button>
                    <button onClick={() => changePhone(s.id, s.phone)} style={{ fontSize: 11, padding: '4px 7px' }}>Change Mobile</button>
                    <button onClick={() => changeName(s.id, s.name)} style={{ fontSize: 11, padding: '4px 7px' }}>Change Name</button>
                    <button onClick={() => changeEmail(s.id, s.email)} style={{ fontSize: 11, padding: '4px 7px' }}>Change Email</button>
                    {s.flaggedSuspicious && (
                      <button onClick={() => clearSuspiciousFlag(s.id)} style={{ fontSize: 11, padding: '4px 7px' }}>Clear Flag</button>
                    )}
                    <button
                      onClick={() => deleteStudent(s.id, s.name ?? s.phone ?? s.email ?? s.id)}
                      style={{ fontSize: 11, padding: '4px 7px', color: '#dc2626', borderColor: '#fca5a5' }}
                    >Delete</button>
                  </div>
                  {s.flaggedSuspicious && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 5, maxWidth: 260 }}>{s.flaggedReason}</div>}
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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