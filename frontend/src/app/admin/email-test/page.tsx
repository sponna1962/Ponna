'use client';

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Oct 2026 — send ONE real-format daily e-mail to a single address so the
// Brevo setup and the layout can be checked before students get anything.
const KINDS = [
  { id: 'MORNING', label: 'காலை — "இன்னும் N நாள்"' },
  { id: 'CURRENT_AFFAIRS', label: 'நடப்பு நிகழ்வுகள் (இன்றைய செய்திகள் இருந்தால்)' },
  { id: 'QUIZ', label: 'Daily Quiz / Brain Challenge (இன்று வெளியாகி இருந்தால்)' },
];

export default function EmailTestPage() {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  async function send(kind: string) {
    setBusy(kind); setMsg('');
    try {
      const res = await adminFetch('/admin/email/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, to }) });
      const body = await res.json().catch(() => ({}));
      setMsg(res.ok && body.ok ? '✅ அனுப்பப்பட்டது — இன்பாக்ஸ் / Spam பார்க்கவும்.' : `❌ ${body.note ?? body.error ?? 'தோல்வி'}`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setBusy('');
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>மின்னஞ்சல் சோதனை</h1>
      <p style={{ color: '#555' }}>உண்மையான வடிவில் ஒரே ஒரு மின்னஞ்சல், கீழே கொடுக்கும் முகவரிக்கு மட்டும் போகும்.</p>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="உங்கள் மின்னஞ்சல்" style={{ width: '100%', padding: 10, margin: '8px 0 14px', border: '1px solid #ccc', borderRadius: 6 }} />
      {KINDS.map((k) => (
        <button key={k.id} disabled={!to || !!busy} onClick={() => send(k.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          {busy === k.id ? 'அனுப்புகிறது…' : k.label}
        </button>
      ))}
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
