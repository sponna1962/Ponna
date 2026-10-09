'use client';

import { useEffect, useMemo, useState } from 'react';
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

const selectStyle: React.CSSProperties = {
  width: '100%', minWidth: 135, padding: '10px 11px', borderRadius: 9,
  border: '1px solid #dbe3ee', background: '#fff', color: '#0f172a', fontSize: 13,
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [townFilter, setTownFilter] = useState('all');
  const [joinedFilter, setJoinedFilter] = useState('all');
  const [testFilter, setTestFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(true);

  async function load() {
    const [studentsRes, statsRes] = await Promise.all([
      adminFetch(`/admin/students?pageSize=1000${search ? `&search=${encodeURIComponent(search)}` : ''}`),
      adminFetch('/admin/platform-stats'),
    ]);
    const data = await studentsRes.json();
    setStudents(data.items ?? []);
    setStats(await statsRes.json());
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const towns = useMemo(() => Array.from(new Set(students.map(s => s.cityTownVillage?.trim()).filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b)), [students]);
  const filteredStudents = useMemo(() => students.filter((s) => {
    if (planFilter !== 'all' && (planFilter === 'free' ? s.activePlan.toLowerCase() !== 'free' : s.activePlan.toLowerCase() === 'free')) return false;
    if (townFilter !== 'all' && s.cityTownVillage?.trim() !== townFilter) return false;
    if (testFilter !== 'all' && String(s.isTestAccount) !== testFilter) return false;
    if (flagFilter !== 'all' && String(s.flaggedSuspicious) !== flagFilter) return false;
    if (joinedFilter !== 'all') {
      const joined = new Date(s.createdAt);
      const now = new Date();
      const days = joinedFilter === '7' ? 7 : joinedFilter === '30' ? 30 : 365;
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      if (joined < cutoff || joined > now) return false;
    }
    return true;
  }), [students, planFilter, townFilter, joinedFilter, testFilter, flagFilter]);

  const activeFilterCount = [planFilter !== 'all', townFilter !== 'all', joinedFilter !== 'all', testFilter !== 'all', flagFilter !== 'all'].filter(Boolean).length;
  function clearFilters() {
    setPlanFilter('all'); setTownFilter('all'); setJoinedFilter('all'); setTestFilter('all'); setFlagFilter('all');
  }

  async function toggleTestAccount(id: string, current: boolean) {
    const res = await adminFetch(`/admin/students/${id}/test-account`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTestAccount: !current }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`); return;
    }
    load();
  }

  async function clearSuspiciousFlag(id: string) {
    const res = await adminFetch(`/admin/students/${id}/clear-suspicious-flag`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`); return;
    }
    load();
  }

  async function changePhone(id: string, currentPhone: string | null) {
    const newPhone = prompt(`Enter the new phone number to link to this account (currently: ${currentPhone ?? 'none'}):`);
    if (!newPhone?.trim()) return;
    if (!confirm(`Change this account's phone number to ${newPhone.trim()}? This keeps all its history/data — only the linked number changes.`)) return;
    const res = await adminFetch(`/admin/students/${id}/change-phone`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPhone: newPhone.trim() }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`); return; }
    load();
  }

  async function changeName(id: string, currentName: string | null) {
    const newName = prompt(`Enter the corrected name for this account (currently: ${currentName ?? 'none'}):`);
    if (!newName?.trim()) return;
    const res = await adminFetch(`/admin/students/${id}/change-name`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newName: newName.trim() }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`); return; }
    load();
  }

  async function changeEmail(id: string, currentEmail: string | null) {
    const newEmail = prompt(`Enter the new email address for this account (currently: ${currentEmail ?? 'none'}):`);
    if (!newEmail?.trim()) return;
    if (!confirm(`Change this account's email to ${newEmail.trim()}? All history/data stays — only the email changes.`)) return;
    const res = await adminFetch(`/admin/students/${id}/change-email`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newEmail: newEmail.trim() }),
    });
    if (!res.ok) { const body = await res.json().catch(() => ({})); alert(`Failed: ${body.error ?? 'Only Super Admin can change this'}`); return; }
    load();
  }

  async function deleteStudent(id: string, label: string) {
    const typed = prompt(`This permanently deletes "${label}" and ALL its data (subscriptions, quiz history, Daily Quiz attempts, everything) — this cannot be undone.\\n\\nType the account's name/phone/email exactly to confirm:`);
    if (typed?.trim() !== label.trim()) { if (typed !== null) alert('Did not match — nothing was deleted.'); return; }
    const res = await adminFetch(`/admin/students/${id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); alert(`Failed: ${body.error ?? 'Only Super Admin can delete accounts'}`); return; }
    load();
  }

  return (
    <div style={{ color: '#0f172a' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>PONNA · ADMIN CONSOLE</div>
          <h1 style={{ fontSize: 27, lineHeight: 1.15, letterSpacing: '-.035em', margin: 0, fontWeight: 800 }}>Student Management</h1>
          <p style={{ color: '#64748b', margin: '7px 0 0', fontSize: 13 }}>Find accounts, review plans and narrow the list with filters.</p>
        </div>
        <button onClick={load} style={{ padding: '10px 14px', border: '1px solid #dbe3ee', background: '#fff', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>↻ Refresh list</button>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: 12, marginBottom: 22 }}>
          <Stat label="Total Students" value={stats.totalStudents} />
          <Stat label="Active Paid Plans" value={stats.activeSubscriptions} />
          <Stat label="Sessions Completed" value={stats.totalSessionsCompleted} />
          <Stat label="Questions Answered" value={stats.totalQuestionsAnswered} />
          <Stat label="Flagged in Current List" value={students.filter(s => s.flaggedSuspicious).length} highlight />
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: '0 4px 16px rgba(15,23,42,.035)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', background: '#eef2ff', color: '#4338ca', fontSize: 17 }}>⚙</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Search & Filters</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Combine filters to show only matching students.</div>
            </div>
            {activeFilterCount > 0 && <span style={{ background: '#eef2ff', color: '#4338ca', fontWeight: 800, fontSize: 11, padding: '4px 8px', borderRadius: 20 }}>{activeFilterCount} active</span>}
          </div>
          <button onClick={() => setFiltersOpen(v => !v)} style={{ border: 0, background: 'transparent', color: '#475569', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{filtersOpen ? 'Hide filters −' : 'Show filters +'}</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: filtersOpen ? 16 : 0 }}>
          <input placeholder="Search name, email, mobile, town or district" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ flex: 1, minWidth: 150, padding: '11px 13px', borderRadius: 9, border: '1px solid #dbe3ee', fontSize: 13, outlineColor: '#6366f1' }} />
          <button onClick={load} style={{ padding: '10px 17px', borderRadius: 9, border: 0, background: '#4338ca', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Search</button>
        </div>

        {filtersOpen && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 12 }}>
          <div><label style={fieldLabel}>Plan</label><select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={selectStyle}><option value="all">All plans</option><option value="paid">Paid plan</option><option value="free">Free plan</option></select></div>
          <div><label style={fieldLabel}>Town / City</label><select value={townFilter} onChange={e => setTownFilter(e.target.value)} style={selectStyle}><option value="all">All towns / cities</option>{towns.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label style={fieldLabel}>Joined</label><select value={joinedFilter} onChange={e => setJoinedFilter(e.target.value)} style={selectStyle}><option value="all">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="365">Last 12 months</option></select></div>
          <div><label style={fieldLabel}>Test account</label><select value={testFilter} onChange={e => setTestFilter(e.target.value)} style={selectStyle}><option value="all">All accounts</option><option value="false">Regular students</option><option value="true">Test accounts only</option></select></div>
          <div><label style={fieldLabel}>Review status</label><select value={flagFilter} onChange={e => setFlagFilter(e.target.value)} style={selectStyle}><option value="all">All statuses</option><option value="true">Flagged for review</option><option value="false">Not flagged</option></select></div>
        </div>}
        {activeFilterCount > 0 && <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Showing <strong style={{ color: '#0f172a' }}>{filteredStudents.length}</strong> of {students.length} loaded students</span>
          <button onClick={clearFilters} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4338ca', fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>Clear all filters ×</button>
        </div>}
      </section>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 2px 10px' }}>
        <div style={{ fontSize: 13, color: '#475569' }}>Student directory <strong style={{ color: '#0f172a' }}>({filteredStudents.length})</strong></div>
        <div style={{ fontSize: 11, color: '#64748b' }}>Select any combination of filters · results update instantly</div>
      </div>
      <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 16px rgba(15,23,42,.025)' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', background: '#f8fafc' }}>
            <th style={{ padding: 13 }}>Plan</th><th style={{ padding: 13 }}>Student Name</th><th style={{ padding: 13 }}>Email</th><th style={{ padding: 13 }}>Mobile</th><th style={{ padding: 13 }}>Town / City</th><th style={{ padding: 13 }}>Joined Date</th><th style={{ padding: 13 }}>Admin Actions</th>
          </tr></thead>
          <tbody>
            {filteredStudents.map(s => <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: s.flaggedSuspicious ? '#fff7f7' : undefined }}>
              <td style={{ padding: 13, whiteSpace: 'nowrap' }}><span style={{ display: 'inline-block', padding: '5px 9px', borderRadius: 999, fontSize: 11, fontWeight: 800, background: s.activePlan.toLowerCase() === 'free' ? '#f1f5f9' : '#dcfce7', color: s.activePlan.toLowerCase() === 'free' ? '#475569' : '#166534' }}>{s.activePlan}</span>{s.isTestAccount && <div style={{ marginTop: 5, fontSize: 11, color: '#b45309', fontWeight: 700 }}>🧪 TEST ACCOUNT</div>}</td>
              <td style={{ padding: 13, minWidth: 145 }}><a href={`/admin/students/${s.id}`} style={{ color: '#0f172a', fontWeight: 750, textDecoration: 'none' }}>{s.name || 'Name not provided'}</a>{s.flaggedSuspicious && <div style={{ color: '#b91c1c', fontSize: 11, marginTop: 5, fontWeight: 700 }}>⚑ Flagged for review</div>}</td>
              <td style={{ padding: 13 }}>{s.email || '—'}</td><td style={{ padding: 13, whiteSpace: 'nowrap' }}>{s.phone || '—'}</td><td style={{ padding: 13 }}>{[s.cityTownVillage, s.district].filter(Boolean).join(', ') || '—'}</td>
              <td style={{ padding: 13, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
              <td style={{ padding: 13, minWidth: 230 }}><div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button onClick={() => toggleTestAccount(s.id, s.isTestAccount)} style={{ fontSize: 11, padding: '5px 7px', cursor: 'pointer' }}>{s.isTestAccount ? 'Unmark Test' : 'Mark Test'}</button>
                <button onClick={() => changePhone(s.id, s.phone)} style={{ fontSize: 11, padding: '5px 7px', cursor: 'pointer' }}>Change Mobile</button>
                <button onClick={() => changeName(s.id, s.name)} style={{ fontSize: 11, padding: '5px 7px', cursor: 'pointer' }}>Change Name</button>
                <button onClick={() => changeEmail(s.id, s.email)} style={{ fontSize: 11, padding: '5px 7px', cursor: 'pointer' }}>Change Email</button>
                {s.flaggedSuspicious && <button onClick={() => clearSuspiciousFlag(s.id)} style={{ fontSize: 11, padding: '5px 7px', cursor: 'pointer' }}>Clear Flag</button>}
                <button onClick={() => deleteStudent(s.id, s.name ?? s.phone ?? s.email ?? s.id)} style={{ fontSize: 11, padding: '5px 7px', color: '#dc2626', borderColor: '#fca5a5', cursor: 'pointer' }}>Delete</button>
              </div>{s.flaggedSuspicious && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 6, maxWidth: 260 }}>{s.flaggedReason}</div>}</td>
            </tr>)}
            {filteredStudents.length === 0 && <tr><td colSpan={7} style={{ padding: 34, textAlign: 'center', color: '#94a3b8' }}><div style={{ fontSize: 22, marginBottom: 8 }}>⌕</div><div style={{ color: '#334155', fontWeight: 700 }}>No matching students</div><div style={{ fontSize: 12, marginTop: 4 }}>Try changing the filters or clear them to see everyone in this list.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return <div style={{ background: '#fff', border: `1px solid ${highlight && value > 0 ? '#fecaca' : '#e2e8f0'}`, borderRadius: 12, padding: '14px 16px', boxShadow: '0 3px 12px rgba(15,23,42,.025)' }}>
    <div style={{ fontSize: 22, fontWeight: 800, color: highlight && value > 0 ? '#991b1b' : '#0f172a', letterSpacing: '-.03em' }}>{value.toLocaleString('en-IN')}</div>
    <div style={{ fontSize: 11, fontWeight: 650, color: '#64748b', marginTop: 4 }}>{label}</div>
  </div>;
}
