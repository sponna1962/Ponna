'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Staff Management — implements §7.8 (Manage staff accounts and assign
// roles). Super Admin only, both on the backend (already enforced) and here
// (page hides the create-form and deactivate buttons for anyone else).

type StaffMember = {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CONTENT_ADMIN' | 'VIEWER_STAFF';
  active: boolean;
  createdAt: string;
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  CONTENT_ADMIN: 'Content Admin',
  VIEWER_STAFF: 'Viewer / Staff',
};

const emptyForm = { email: '', password: '', role: 'CONTENT_ADMIN' };

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('ponna_staff_role') === 'SUPER_ADMIN';

  async function load() {
    const res = await adminFetch('/admin/staff');
    if (res.ok) setStaff(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function createStaff() {
    setError(null);
    const res = await adminFetch('/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to create staff account');
      return;
    }
    setForm(emptyForm);
    setShowForm(false);
    load();
  }

  async function deactivate(id: string) {
    await adminFetch(`/admin/staff/${id}/deactivate`, { method: 'POST' });
    load();
  }

  if (!isSuperAdmin) {
    return (
      <div>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Staff</h1>
        <p style={{ color: '#94a3b8', fontSize: 13 }}>Only Super Admins can view or manage staff accounts.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20 }}>Staff</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}
        >
          {showForm ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
          <input
            type="password"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ width: '100%', padding: 8, marginBottom: 8, borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={{ width: '100%', padding: 8, marginBottom: 12, borderRadius: 6, border: '1px solid #cbd5e1' }}
          >
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="CONTENT_ADMIN">Content Admin</option>
            <option value="VIEWER_STAFF">Viewer / Staff</option>
          </select>
          <button onClick={createStaff} style={{ padding: '8px 20px', borderRadius: 6, background: '#0f172a', color: '#fff', border: 'none' }}>
            Create
          </button>
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
            <th style={{ padding: 10 }}>Email</th>
            <th style={{ padding: 10 }}>Role</th>
            <th style={{ padding: 10 }}>Status</th>
            <th style={{ padding: 10 }}>Added</th>
            <th style={{ padding: 10 }}></th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: 10 }}>{s.email}</td>
              <td style={{ padding: 10 }}>{roleLabels[s.role]}</td>
              <td style={{ padding: 10 }}>
                <span style={{ padding: '2px 8px', borderRadius: 10, background: s.active ? '#dcfce7' : '#fee2e2', color: s.active ? '#166534' : '#991b1b' }}>
                  {s.active ? 'Active' : 'Deactivated'}
                </span>
              </td>
              <td style={{ padding: 10, color: '#94a3b8' }}>{new Date(s.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: 10 }}>
                {s.active && (
                  <button onClick={() => deactivate(s.id)} style={{ fontSize: 12 }}>Deactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
