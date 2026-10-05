'use client';

// Manual UPI Payments — interim approval queue (Oct 2026) used while no
// payment gateway is approved. A student pays the business UPI ID in their
// own UPI app and submits the 12-digit UTR on the Plans page. Before
// approving, check that the SAME amount with the SAME UTR actually shows in
// your bank/UPI app's transaction history. Approving creates the student's
// pass immediately; it cannot be undone from here.

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

type Row = {
  id: string;
  utr: string;
  amount: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { name: string | null; phone: string | null; email: string | null };
  plan: { name: string };
};

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#fef3c7', fg: '#92400e' },
  APPROVED: { bg: '#dcfce7', fg: '#166534' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
};

export default function ManualPaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    const params = filter ? `?status=${filter}` : '';
    adminFetch(`/admin/manual-payments${params}`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function act(row: Row, action: 'approve' | 'reject') {
    const who = row.user.name || row.user.phone || row.user.email || 'this student';
    if (action === 'approve' && !window.confirm(`Approve ₹${row.amount} (UTR ${row.utr}) from ${who}?\nOnly approve if this exact amount and UTR shows in your bank/UPI history.`)) return;
    const note = action === 'reject' ? window.prompt('Reason (optional, internal note):') ?? undefined : undefined;
    if (action === 'reject' && note === undefined) return;

    setBusyId(row.id);
    setMessage(null);
    try {
      const res = await adminFetch(`/admin/manual-payments/${row.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setMessage(body.error ?? 'Action failed');
    } finally {
      setBusyId(null);
      load();
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Manual UPI Payments</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Students who paid by UPI and submitted the transaction ID. Verify the amount and UTR in your bank/UPI app first, then Approve — the
        student&apos;s pass activates immediately.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['PENDING', 'APPROVED', 'REJECTED', ''] as const).map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFilter(s)}
            style={{
              padding: '6px 14px',
              borderRadius: 16,
              border: '1px solid #cbd5e1',
              background: filter === s ? '#0f172a' : '#fff',
              color: filter === s ? '#fff' : '#334155',
              fontSize: 13,
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {message && <p style={{ color: '#b91c1c', fontSize: 13 }}>{message}</p>}
      {!loaded && <p style={{ color: '#94a3b8' }}>Loading…</p>}
      {loaded && rows.length === 0 && <p style={{ color: '#94a3b8' }}>Nothing here.</p>}

      {rows.map((r) => {
        const c = STATUS_COLORS[r.status];
        return (
          <div key={r.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.fg, background: c.bg, padding: '3px 10px', borderRadius: 12 }}>{r.status}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>
              ₹{r.amount} <span style={{ fontSize: 13, fontWeight: 400, color: '#64748b' }}>— {r.plan.name}</span>
            </p>
            <p style={{ fontSize: 14, margin: '0 0 4px' }}>
              UTR: <strong style={{ fontFamily: 'monospace', fontSize: 15 }}>{r.utr}</strong>
            </p>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px' }}>
              {r.user.name ?? '—'} · {r.user.phone ?? '—'} · {r.user.email ?? '—'}
            </p>
            {r.adminNote && <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>Note: {r.adminNote}</p>}
            {r.status === 'PENDING' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={busyId === r.id}
                  onClick={() => act(r, 'approve')}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#166534', color: '#fff', fontWeight: 600 }}
                >
                  Approve
                </button>
                <button
                  disabled={busyId === r.id}
                  onClick={() => act(r, 'reject')}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#991b1b', fontWeight: 600 }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
