'use client';

// Oct 2026 — one-time "remind me tomorrow?" card shown after a finished
// practice session (the moment the student feels the value). Until now the only
// place to switch on notifications was the Profile page, so almost nobody did.
// Shows nothing if notifications are unsupported, not configured on the server,
// already on, or the student said "not now" before.

import { useEffect, useState } from 'react';
import { studentFetch } from '../lib/student-fetch';

type Status = { configured: boolean; subscribed: boolean; vapidPublicKey: string | null };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushPrompt() {
  const [status, setStatus] = useState<Status | null>(null);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    try {
      if (localStorage.getItem('ponna_push_dismissed') === '1') return;
    } catch {}
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;
    studentFetch('/students/me/push-subscription/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => {
        if (s && s.configured && s.vapidPublicKey && !s.subscribed) { setStatus(s); setHidden(false); }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    try { localStorage.setItem('ponna_push_dismissed', '1'); } catch {}
    setHidden(true);
  }

  async function enable() {
    if (!status?.vapidPublicKey) return;
    setBusy(true); setMsg('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { dismiss(); return; }
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW_TIMEOUT')), 8000)),
      ]);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(status.vapidPublicKey) as BufferSource,
      });
      const res = await studentFetch('/students/me/push-subscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error('SAVE_FAILED');
      setMsg('✅ சரி! நாளை நினைவூட்டுகிறோம்.');
      setTimeout(() => setHidden(true), 2500);
    } catch {
      setMsg('இப்போது இயக்க முடியவில்லை. Profile பக்கத்தில் மீண்டும் முயலலாம்.');
    } finally {
      setBusy(false);
    }
  }

  if (hidden) return null;
  return (
    <div style={{ background: '#FFF6DC', border: '1px solid #E2B04A', borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 15 }}>🔔 நாளை நினைவூட்டவா?</div>
      <p style={{ fontSize: 12.5, color: '#555', margin: '6px 0 10px', lineHeight: 1.55 }}>தினமும் ஒரு சிறு செய்தி — உங்கள் streak உடையாமல் காக்க. எப்போது வேண்டுமானாலும் நிறுத்தலாம்.</p>
      {msg ? <div style={{ fontSize: 13, fontWeight: 700 }}>{msg}</div> : (
        <>
          <button onClick={enable} disabled={busy} style={{ width: '100%', padding: 11, border: 'none', borderRadius: 9, background: '#FFD22A', color: '#0B3864', fontWeight: 800, fontSize: 14.5, cursor: 'pointer' }}>{busy ? 'காத்திருக்கவும்…' : 'ஆம், நினைவூட்டுங்கள்'}</button>
          <button onClick={dismiss} style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: '#777', fontSize: 12.5, cursor: 'pointer' }}>இப்போது வேண்டாம்</button>
        </>
      )}
    </div>
  );
}
