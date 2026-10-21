'use client';

import { useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Oct 2026 — send ONE WhatsApp template message to a single number so the
// Cloud API setup (token, phone number ID, template) can be verified
// before any student is messaged.
const KINDS = [
  { id: 'HELLO_WORLD', label: 'Meta சோதனை template (hello_world) அனுப்பு' },
  { id: 'WELCOME', label: 'வரவேற்பு template (ponna_welcome) அனுப்பு' },
];

export default function WhatsAppTestPage() {
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  async function send(kind: string) {
    setBusy(kind); setMsg('');
    try {
      const res = await adminFetch('/admin/whatsapp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, to }) });
      const body = await res.json().catch(() => ({}));
      setMsg(res.ok && body.ok ? `✅ அனுப்பப்பட்டது — WhatsApp-ஐப் பாருங்கள். (${body.messageId ?? ''})` : `❌ ${body.error ?? 'தோல்வி'}`);
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setBusy('');
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h1>WhatsApp சோதனை</h1>
      <p style={{ color: '#555' }}>ஒரே ஒரு சோதனைச் செய்தி, கீழே கொடுக்கும் எண்ணுக்கு மட்டும் போகும். மாணவர்களுக்கு எதுவும் போகாது.</p>
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="உங்கள் WhatsApp எண் (10 இலக்கம்)" inputMode="numeric" style={{ width: '100%', padding: 10, margin: '8px 0 14px', border: '1px solid #ccc', borderRadius: 6 }} />
      {KINDS.map((k) => (
        <button key={k.id} disabled={!to || !!busy} onClick={() => send(k.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: 12, marginBottom: 8, border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
          {busy === k.id ? 'அனுப்புகிறது…' : k.label}
        </button>
      ))}
      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
