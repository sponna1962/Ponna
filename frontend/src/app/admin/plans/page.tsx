'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Plans & Subscriptions Management — implements §7.6: manage plan
// definitions. Plan quota structure (5/day, 600 or 1500 per 30 days) is
// fixed by the requirements doc and not editable here — only price and
// active/inactive status, since pricing was explicitly left "to be finalized
// separately" (§13 Open Items).

type Plan = {
  id: string;
  code: string;
  name: string;
  dailyLimit: number | null;
  cycleLimit: number | null;
  cycleDays: number;
  price: string | null;
  active: boolean;
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const isSuperAdmin = typeof window !== 'undefined' && localStorage.getItem('ponna_staff_role') === 'SUPER_ADMIN';

  async function load() {
    const res = await adminFetch('/admin/plans');
    setPlans(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function savePrice(planId: string) {
    const value = editingPrice[planId];
    if (value === undefined) return;
    await adminFetch(`/admin/plans/${planId}/price`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: Number(value) }),
    });
    load();
  }

  async function toggleActive(planId: string, currentlyActive: boolean) {
    await adminFetch(`/admin/plans/${planId}/${currentlyActive ? 'deactivate' : 'activate'}`, { method: 'POST' });
    load();
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Plans</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        Quota structure (daily/30-day limits) is fixed per the finalized requirements. Price and active status can be changed here.
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

          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {p.dailyLimit ? `${p.dailyLimit} questions/day` : `${p.cycleLimit} questions per ${p.cycleDays}-day cycle, no daily limit`}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 13, color: '#334155' }}>Price (₹):</label>
            <input
              type="number"
              defaultValue={p.price ?? ''}
              disabled={!isSuperAdmin}
              onChange={(e) => setEditingPrice({ ...editingPrice, [p.id]: e.target.value })}
              placeholder="Not set"
              style={{ width: 100, padding: 6, borderRadius: 6, border: '1px solid #cbd5e1' }}
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
        </div>
      ))}
    </div>
  );
}
