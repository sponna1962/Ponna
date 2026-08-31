'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Plans & Subscriptions Management — Plans are now fully dynamic (Annual
// Plan redesign, Phase 2): each Plan has a scope (a whole Purpose, or one
// or more specific Authorities) set at creation, unlimited practice within
// that scope for its 365-day validity, and separate regular/launch prices.
// This screen currently covers price/active editing; full create-a-new-Plan
// and scope-editing UI is Phase 3+.

type Plan = {
  id: string;
  name: string;
  nameTa: string | null;
  dailyLimit: number | null;
  cycleDays: number | null;
  regularPrice: string | null;
  launchPrice: string | null;
  active: boolean;
  isFree: boolean;
  purpose: { name: string } | null;
  authorityScopes: { authority: { name: string } }[];
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPrice, setEditingPrice] = useState<Record<string, { regular: string; launch: string }>>({});
  const isSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('ponna_staff_role') === 'SUPER_ADMIN';

  async function load() {
    const res = await adminFetch('/admin/plans');
    setPlans(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function savePrice(planId: string) {
    const value = editingPrice[planId];
    if (!value) return;
    await adminFetch(`/admin/plans/${planId}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regularPrice: value.regular !== '' ? Number(value.regular) : null,
        launchPrice: value.launch !== '' ? Number(value.launch) : null,
      }),
    });
    load();
  }

  async function toggleActive(planId: string, currentlyActive: boolean) {
    await adminFetch(`/admin/plans/${planId}/${currentlyActive ? 'deactivate' : 'activate'}`, { method: 'POST' });
    load();
  }

  function scopeLabel(p: Plan): string {
    if (p.isFree) return `Free fallback — ${p.dailyLimit ?? 5} questions/day (any exam without an active paid Plan)`;
    if (p.purpose) return `Covers entire Purpose: ${p.purpose.name}`;
    if (p.authorityScopes.length > 0) return `Covers: ${p.authorityScopes.map((s) => s.authority.name).join(' + ')}`;
    return 'No scope set';
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Plans</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Paid plans give unlimited practice for 12 months within their scope — no question-count quota. Price and active status can be changed here.
        {!isSuperAdmin && ' (Viewing only — Super Admin role required to change these.)'}
      </p>

      {plans.map((p) => (
        <div key={p.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{p.name}</strong>
            <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 10, background: p.active ? '#dcfce7' : '#fee2e2', color: p.active ? '#166534' : '#991b1b' }}>
              {p.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{scopeLabel(p)}</p>

          {!p.isFree && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, color: '#334155' }}>Regular ₹/year:</label>
              <input
                type="number"
                defaultValue={p.regularPrice ?? ''}
                disabled={!isSuperAdmin}
                onChange={(e) => setEditingPrice({ ...editingPrice, [p.id]: { regular: e.target.value, launch: editingPrice[p.id]?.launch ?? p.launchPrice ?? '' } })}
                placeholder="Not set"
                style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
              <label style={{ fontSize: 13, color: '#334155' }}>Launch ₹/year:</label>
              <input
                type="number"
                defaultValue={p.launchPrice ?? ''}
                disabled={!isSuperAdmin}
                onChange={(e) => setEditingPrice({ ...editingPrice, [p.id]: { regular: editingPrice[p.id]?.regular ?? p.regularPrice ?? '', launch: e.target.value } })}
                placeholder="(optional)"
                style={{ width: 90, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}
              />
              {isSuperAdmin && (
                <>
                  <button onClick={() => savePrice(p.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>Save</button>
                  <button onClick={() => toggleActive(p.id, p.active)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 13, marginLeft: 'auto' }}>
                    {p.active ? 'Deactivate' : 'Activate'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
