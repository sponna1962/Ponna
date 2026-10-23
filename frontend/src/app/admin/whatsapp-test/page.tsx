'use client';

import { useEffect, useState } from 'react';
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
  const [targets, setTargets] = useState<{ id: string; name: string | null; phone: string; createdAt: string }[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [fbMsg, setFbMsg] = useState<string[]>([]);
  const [fbBusy, setFbBusy] = useState(false);

  useEffect(() => {
    adminFetch('/admin/whatsapp/targets?days=10').then((r) => (r.ok ? r.json() : [])).then(setTargets).catch(() => {});
  }, []);

  async function sendFeedback() {
    const ids = targets.filter((t) => picked[t.id]).map((t) => t.id);
    if (ids.length === 0 || !confirm(`${ids.length} பேருக்கு கருத்துக் கேட்புச் செய்தி அனுப்பவா?`)) return;
    setFbBusy(true); setFbMsg([]);
    try {
      const r = await adminFetch('/admin/whatsapp/send-feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: ids }) });
      const b = await r.json().catch(() => ({}));
      setFbMsg(r.ok ? (b.results ?? []).map((x: any) => `${x.ok ? '✅' : '❌'} ${x.name ?? ''} ${x.error ?? ''}`) : [`❌ ${b.error ?? 'தோல்வி'}`]);
    } catch (e: any) { setFbMsg([`❌ ${e.message}`]); }
    setFbBusy(false);
  }

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

      <h2 style={{ marginTop: 32 }}>கருத்துக் கேட்புச் செய்தி</h2>
      <p style={{ color: '#555' }}>கடந்த 10 நாளில் பதிவு செய்தவர்களில் தேர்ந்தெடுத்தவர்களுக்கு, Meta அனுமதி பெற்ற <b>ponna_feedback</b> template அனுப்பப்படும் (ஒரு முறை 30 பேர் வரை). அவர்கள் பதில் Inbox-ல் வரும்.</p>
      {targets.length === 0 && <p style={{ color: '#777' }}>யாரும் இல்லை.</p>}
      {targets.map((t) => (
        <label key={t.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #eee' }}>
          <input type="checkbox" checked={!!picked[t.id]} onChange={(e) => setPicked({ ...picked, [t.id]: e.target.checked })} />
          <span>{t.name || '(பெயர் இல்லை)'} — {t.phone}</span>
        </label>
      ))}
      {targets.length > 0 && (
        <button disabled={fbBusy} onClick={sendFeedback} style={{ marginTop: 12, padding: '10px 16px', border: 0, borderRadius: 6, background: '#16a34a', color: '#fff', cursor: 'pointer' }}>{fbBusy ? 'அனுப்புகிறது…' : 'தேர்ந்தெடுத்தவர்களுக்கு அனுப்பு'}</button>
      )}
      {fbMsg.map((m, i) => <p key={i} style={{ margin: '4px 0' }}>{m}</p>)}
    </div>
  );
}
