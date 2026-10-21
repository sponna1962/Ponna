'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '../../../lib/admin-fetch';

// Oct 2026 — every WhatsApp message people send to the PONNA number, with a
// manual reply box (free only within 24 h of their last message).
type Conversation = { phone: string; name: string | null; optedIn: boolean; lastInboundAt: string | null; canReply: boolean; lastMessage: string | null; lastDirection: string | null };
type Message = { id: string; direction: 'IN' | 'OUT'; kind: string; body: string | null; createdAt: string };

function fmt(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function WhatsAppInboxPage() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string>('');
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConvs = useCallback(async () => {
    try { const r = await adminFetch('/admin/whatsapp/conversations'); if (r.ok) setConvs(await r.json()); } catch { /* ignore */ }
  }, []);
  const loadMsgs = useCallback(async (phone: string) => {
    if (!phone) return;
    try { const r = await adminFetch(`/admin/whatsapp/messages?phone=${phone}`); if (r.ok) setMsgs(await r.json()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadConvs(); const t = setInterval(loadConvs, 20000); return () => clearInterval(t); }, [loadConvs]);
  useEffect(() => { loadMsgs(active); if (!active) return; const t = setInterval(() => loadMsgs(active), 15000); return () => clearInterval(t); }, [active, loadMsgs]);

  const current = convs.find((c) => c.phone === active);

  async function send() {
    if (!text.trim() || !active) return;
    setBusy(true); setNote('');
    try {
      const r = await adminFetch('/admin/whatsapp/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: active, text }) });
      const b = await r.json().catch(() => ({}));
      if (r.ok && b.ok) { setText(''); await loadMsgs(active); await loadConvs(); } else setNote(`❌ ${b.error ?? 'தோல்வி'}`);
    } catch (e: any) { setNote(`❌ ${e.message}`); }
    setBusy(false);
  }

  return (
    <div>
      <h1>WhatsApp Inbox</h1>
      <p style={{ color: '#555' }}>மக்கள் நம் WhatsApp எண்ணுக்கு அனுப்பும் செய்திகள். முதல் செய்திக்கும் 1–4 எண்களுக்கும் தானியங்கிப் பதில் போகும் (நிலையான உரை).</p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 300, maxHeight: 520, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8, background: '#fff' }}>
          {convs.length === 0 && <p style={{ padding: 12, color: '#777' }}>இன்னும் செய்திகள் இல்லை.</p>}
          {convs.map((c) => (
            <div key={c.phone} onClick={() => setActive(c.phone)} style={{ padding: 10, borderBottom: '1px solid #eee', cursor: 'pointer', background: c.phone === active ? '#e0f2fe' : undefined }}>
              <div style={{ fontWeight: 600 }}>{c.name || `+${c.phone}`} {!c.optedIn && <span style={{ color: '#b91c1c', fontSize: 11 }}>STOP</span>}</div>
              <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lastDirection === 'OUT' ? '↩ ' : ''}{c.lastMessage ?? ''}</div>
              <div style={{ fontSize: 11, color: '#999' }}>{fmt(c.lastInboundAt)}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          {!active ? <p style={{ color: '#777' }}>இடப்பக்கம் ஒருவரைத் தேர்ந்தெடுங்கள்.</p> : (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{current?.name || ''} +{active}</div>
              <div style={{ maxHeight: 400, overflowY: 'auto', background: '#efeae2', padding: 10, borderRadius: 8 }}>
                {msgs.map((m) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.direction === 'IN' ? 'flex-start' : 'flex-end', marginBottom: 6 }}>
                    <div style={{ maxWidth: '80%', background: m.direction === 'IN' ? '#fff' : '#d9fdd3', padding: '6px 10px', borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 14 }}>
                      {m.body ?? `[${m.kind}]`}
                      <div style={{ fontSize: 10, color: '#777', textAlign: 'right' }}>{m.kind === 'auto' ? 'தானியங்கி · ' : ''}{fmt(m.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
              {current?.canReply ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="பதில் எழுதுங்கள்" style={{ flex: 1, padding: 10, border: '1px solid #ccc', borderRadius: 6 }} />
                  <button disabled={busy || !text.trim()} onClick={send} style={{ padding: '10px 16px', border: 0, borderRadius: 6, background: '#16a34a', color: '#fff', cursor: 'pointer' }}>{busy ? '…' : 'அனுப்பு'}</button>
                </div>
              ) : <p style={{ color: '#b45309', fontSize: 13 }}>அவர் கடைசியாக 24 மணி நேரத்துக்கு முன் செய்தி அனுப்பினார் — இப்போது பதிலளிக்க முடியாது.</p>}
              {note && <p>{note}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
