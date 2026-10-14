'use client';

// "Share my result": draws a small picture (in the student's own browser, no
// server, no AI) with their name, what they practised and their own score, then
// opens the phone's share sheet (WhatsApp, Facebook ...). Only the student's
// OWN result is ever shown — never a rank or a comparison with anyone.
// Guests and students without a saved name get the same card without a name.

import { useState } from 'react';
import { studentFetch } from '../lib/student-fetch';

type Props = {
  /** What was practised, e.g. "Daily Quiz — Current Affairs" */
  title: string;
  /** Big text on the picture, e.g. "8 / 10" */
  score: string;
  /** Optional small line under the score, e.g. "80% சரியான விடைகள்" */
  note?: string;
  /** 0-100: how much of the ring is filled (own score only). Full ring when omitted. */
  percent?: number;
  label?: string;
};

const W = 1080;
const H = 1350;
const NAVY = '#0B3864';
const GOLD = '#E2B04A';

async function getName(): Promise<string> {
  try {
    if (typeof window === 'undefined' || !localStorage.getItem('ponna_student_token')) return '';
    const r = await studentFetch('/students/me/profile');
    if (!r.ok) return '';
    const d = await r.json();
    const n = typeof d?.name === 'string' ? d.name.trim() : '';
    return n.length > 26 ? n.slice(0, 25).trim() + '…' : n;
  } catch {
    return '';
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 700) {
  let size = startSize;
  const font = (s: number) => `${weight} ${s}px 'Noto Serif Tamil', 'Noto Sans Tamil', Bitter, serif`;
  ctx.font = font(size);
  while (ctx.measureText(text).width > maxWidth && size > 28) { size -= 2; ctx.font = font(size); }
}

async function drawCard(name: string, title: string, score: string, note: string, percent: number): Promise<Blob | null> {
  try { await document.fonts?.load?.("700 40px 'Noto Serif Tamil'"); } catch { /* fall back to system font */ }
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, NAVY); g.addColorStop(1, '#07243f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GOLD; ctx.fillRect(0, 0, W, 14);

  // Logo
  const logo = await loadImage('/logo-wordmark-sm.png');
  if (logo) {
    const lh = 110; const lw = (logo.width / logo.height) * lh;
    ctx.fillStyle = '#fff';
    const pad = 22;
    roundRect(ctx, (W - lw) / 2 - pad, 70 - pad / 2, lw + pad * 2, lh + pad, 22); ctx.fill();
    ctx.drawImage(logo, (W - lw) / 2, 70, lw, lh);
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // Name
  let y = 330;
  if (name) {
    ctx.fillStyle = '#fff';
    fit(ctx, name, W - 160, 72, 800);
    ctx.fillText(name, W / 2, y);
    y += 62;
    ctx.fillStyle = GOLD; ctx.font = "600 36px 'Noto Serif Tamil', serif";
    ctx.fillText('இன்றைய பயிற்சி முடிவு', W / 2, y);
  } else {
    ctx.fillStyle = GOLD; ctx.font = "700 52px 'Noto Serif Tamil', serif";
    ctx.fillText('இன்றைய பயிற்சி முடிவு', W / 2, y);
  }

  // Score ring
  const cx = W / 2; const cy = 700; const r = 270;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 30; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.stroke();
  if (percent > 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, percent / 100));
    ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.strokeStyle = GOLD; ctx.stroke(); ctx.lineCap = 'butt';
  }
  ctx.fillStyle = '#fff';
  fit(ctx, score, r * 1.5, 150, 800);
  ctx.fillText(score, cx, cy + 40);
  if (note) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = "600 38px 'Noto Serif Tamil', serif";
    ctx.fillText(note, cx, cy + 120);
  }

  // What it was
  ctx.fillStyle = '#fff';
  fit(ctx, title, W - 140, 56, 700);
  ctx.fillText(title, W / 2, 1100);

  // Footer
  ctx.fillStyle = GOLD; ctx.fillRect(140, 1160, W - 280, 3);
  ctx.fillStyle = '#fff'; ctx.font = "700 44px 'Noto Serif Tamil', serif";
  ctx.fillText('TNPSC தேர்வுக்கு இலவசப் பயிற்சி', W / 2, 1232);
  ctx.fillStyle = GOLD; ctx.font = "800 54px Bitter, serif";
  ctx.fillText('ponna.in', W / 2, 1306);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function ShareResultCard({ title, score, note = '', percent = 100, label = 'என் முடிவைப் பகிர்க ↗' }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onShare() {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const name = await getName();
      const blob = await drawCard(name, title, score, note, percent);
      const link = `${window.location.origin}/?utm_source=share`;
      const text = `${name ? name + ' — ' : ''}${title}: ${score}\nPONNA.in-இல் TNPSC தேர்வுக்கு இலவசமாகப் பயிற்சி செய்யலாம்.`;
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
      if (blob) {
        const file = new File([blob], 'ponna-result.png', { type: 'image/png' });
        if (nav.share && nav.canShare?.({ files: [file] })) {
          try { await nav.share({ files: [file], text: `${text}\n${link}` }); return; } catch (e) {
            if ((e as Error)?.name === 'AbortError') return;
          }
        }
        // No picture sharing on this device: save the picture so it can be sent by hand.
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'ponna-result.png';
        document.body.appendChild(a); a.click(); a.remove();
        setMsg('படம் சேமிக்கப்பட்டது. அதை WhatsApp போன்றவற்றில் அனுப்பலாம்.');
        return;
      }
      if (nav.share) { await nav.share({ text, url: link }); return; }
      setMsg('இந்தச் சாதனத்தில் பகிர முடியவில்லை.');
    } catch {
      setMsg('பகிர முடியவில்லை. மீண்டும் முயற்சிக்கவும்.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ponna-noprint" style={{ textAlign: 'center', margin: '14px 0' }}>
      <button
        type="button"
        onClick={onShare}
        disabled={busy}
        style={{ width: '100%', padding: 14, borderRadius: 8, border: '1.5px solid var(--color-gold)', background: 'transparent', color: 'var(--color-gold)', fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? '…' : label}
      </button>
      {msg && <p style={{ fontSize: 13, color: 'var(--color-inkMuted)', margin: '8px 0 0' }}>{msg}</p>}
    </div>
  );
}
