'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Oct 2026 — discount coupons. Create a personal (1 use) or shared (many uses)
// code, copy the link, or open WhatsApp with the message ready to send.
type Row = { id: string; code: string; amountOff: number; maxUses: number; used: number; expiresAt: string; active: boolean; note: string | null };

const SITE = 'https://www.ponna.in';

function waLink(code: string, amountOff: number, expiresAt: string, phone?: string) {
  const until = new Date(expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const text = `வணக்கம்! உங்களுக்காக PONNA.in-ல் ₹${amountOff} சிறப்புச் சலுகை. உங்கள் குறியீடு: ${code}\nஇங்கே உள்ளிடுங்கள்: ${SITE}/coupon?code=${code}\n(${until} வரை செல்லும்)`;
  const num = (phone ?? '').replace(/\D/g, '').slice(-10);
  return `https://wa.me/${num ? '91' + num : ''}?text=${encodeURIComponent(text)}`;
}

export default function CouponsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [amountOff, setAmountOff] = useState('100');
  const [maxUses, setMaxUses] = useState('1');
  const [hours, setHours] = useState('72');
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await adminFetch('/admin/coupons');
    if (r.ok) setRows(await r.json());
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function create() {
    setBusy(true); setMsg('');
    try {
      const r = await adminFetch('/admin/coupons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() || undefined, amountOff: Number(amountOff), maxUses: Number(maxUses), hoursValid: Number(hours), note: [note.trim(), phone.trim()].filter(Boolean).join(' · ') }),
      });
      const b = await r.json().catch(() => ({}));
      setMsg(r.ok ? `✅ உருவானது: ${b.code}` : `❌ ${b.error ?? 'தோல்வி'}`);
      if (r.ok) { setCode(''); await load(); }
    } catch (e: any) { setMsg(`❌ ${e.message}`); }
    setBusy(false);
  }

  async function off(id: string) {
    if (!confirm('இந்தக் குறியீட்டை நிறுத்தவா?')) return;
    await adminFetch(`/admin/coupons/${id}/deactivate`, { method: 'POST' });
    await load();
  }

  const input: React.CSSProperties = { padding: 9, border: '1px solid #ccc', borderRadius: 6, width: '100%', boxSizing: 'border-box' };
  const label: React.CSSProperties = { fontSize: 13, color: '#555', display: 'block', marginBottom: 3 };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1>Coupons</h1>
      <p style={{ color: '#555' }}>குறியீடுகள் தளத்தில் எங்கும் தெரியாது. நீங்கள் கொடுப்பவர்கள் மட்டுமே /coupon பக்கத்தில் உள்ளிட முடியும். தள்ளுபடி ₹499 Pass-க்கு மட்டும்.</p>

      <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <div><label style={label}>தள்ளுபடி (₹)</label><input style={input} value={amountOff} onChange={(e) => setAmountOff(e.target.value)} inputMode="numeric" /></div>
          <div><label style={label}>எத்தனை பேர் பயன்படுத்தலாம்</label><input style={input} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" /></div>
          <div><label style={label}>எத்தனை மணி நேரம் செல்லும்</label><input style={input} value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" /></div>
          <div><label style={label}>குறியீடு (காலியாக விட்டால் தானாக)</label><input style={input} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="எ.கா. TODAY100" /></div>
          <div><label style={label}>குறிப்பு (யாருக்கு)</label><input style={input} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div><label style={label}>போன் எண் (WhatsApp அனுப்ப)</label><input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" /></div>
        </div>
        <p style={{ fontSize: 12, color: '#777', margin: '8px 0' }}>தனிநபருக்கு: 1 பேர் · 72 மணி. "இன்று ஒரு நாள்" சலுகைக்கு: பலர் (எ.கா. 100) · இன்று நள்ளிரவு வரை உள்ள மணி நேரம்.</p>
        <button onClick={create} disabled={busy} style={{ padding: '10px 18px', border: 'none', borderRadius: 6, background: '#0f3a5f', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{busy ? '…' : 'குறியீடு உருவாக்கு'}</button>
        {msg && <span style={{ marginLeft: 12 }}>{msg}</span>}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}><th>குறியீடு</th><th>₹</th><th>பயன்பாடு</th><th>முடிவு</th><th></th></tr></thead>
        <tbody>
          {rows.map((c) => {
            const expired = new Date(c.expiresAt).getTime() <= Date.now();
            const state = !c.active ? 'நிறுத்தப்பட்டது' : expired ? 'காலாவதி' : c.used >= c.maxUses ? 'முடிந்தது' : 'செயலில்';
            return (
              <tr key={c.id} style={{ borderBottom: '1px solid #eee', opacity: state === 'செயலில்' ? 1 : 0.55 }}>
                <td style={{ padding: '8px 4px' }}><b>{c.code}</b>{c.note && <div style={{ fontSize: 12, color: '#777' }}>{c.note}</div>}</td>
                <td>{c.amountOff}</td>
                <td>{c.used}/{c.maxUses}</td>
                <td>{new Date(c.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}<div style={{ fontSize: 12 }}>{state}</div></td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => navigator.clipboard?.writeText(`${SITE}/coupon?code=${c.code}`)} style={{ marginRight: 6 }}>இணைப்பு நகல்</button>
                  <a href={waLink(c.code, c.amountOff, c.expiresAt, (c.note ?? '').match(/\d{10}/)?.[0])} target="_blank" rel="noopener noreferrer" style={{ marginRight: 6 }}>WhatsApp</a>
                  {state === 'செயலில்' && <button onClick={() => off(c.id)}>நிறுத்து</button>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
