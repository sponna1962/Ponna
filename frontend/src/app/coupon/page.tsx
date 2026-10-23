'use client';

// Coupon page (Oct 2026). Deliberately NOT linked from any menu or page: the
// owner gives a code (or a link like /coupon?code=XXXX) by phone/WhatsApp, and
// only then does the student see a reduced price. The Plans page keeps showing
// the normal price. The discount itself is applied and re-checked on the server.

import { useEffect, useState } from 'react';
import { studentFetch } from '../../lib/student-fetch';
import { rememberAfterLogin } from '../../lib/after-login';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Quote = { code: string; planId: string; planName: string; price: number; discount: number; finalAmount: number; expiresAt: string };

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function CouponPage() {
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasPass, setHasPass] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ponna_student_token');
    const qs = new URLSearchParams(window.location.search).get('code') ?? '';
    if (!token) {
      rememberAfterLogin('/coupon' + (qs ? `?code=${encodeURIComponent(qs)}` : ''));
      window.location.href = '/?startLogin=1';
      return;
    }
    studentFetch('/students/me/subscriptions')
      .then((r) => (r.ok ? r.json() : []))
      .then((subs: any[]) => setHasPass(subs.some((s) => !s.plan?.isTrial && !s.plan?.isFree && new Date(s.validUntil ?? s.cycleEnd ?? 0).getTime() > Date.now())))
      .catch(() => {})
      .finally(() => setReady(true));
    if (qs) { setCode(qs); check(qs); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check(value = code) {
    setError(''); setQuote(null);
    if (!value.trim()) return;
    setBusy(true);
    try {
      const res = await studentFetch('/coupons/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: value }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error ?? 'குறியீட்டைச் சரிபார்க்க முடியவில்லை.');
      else setQuote(body);
    } catch { setError('இணையத் தொடர்பைச் சரிபாருங்கள்.'); }
    setBusy(false);
  }

  async function pay() {
    if (!quote) return;
    setError(''); setBusy(true);
    try {
      const res = await studentFetch('/payments/payu/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: quote.planId, couponCode: quote.code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'பணம் செலுத்தத் தொடங்க முடியவில்லை.');
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = body.action;
      for (const [k, v] of Object.entries(body.fields as Record<string, string>)) {
        const input = document.createElement('input');
        input.type = 'hidden'; input.name = k; input.value = String(v ?? '');
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 18 };

  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, minHeight: '100vh', paddingBottom: 48 }}>
      <BitterFontLinks />
      <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>கூப்பன் குறியீடு</h1>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '18px 16px' }}>
        {ready && hasPass ? (
          <div style={card}>உங்களிடம் ஏற்கனவே PONNA Pass உள்ளது. 🎉</div>
        ) : (
          <div style={card}>
            <p style={{ margin: '0 0 10px', fontWeight: 700 }}>உங்களுக்கு வழங்கப்பட்ட குறியீட்டை உள்ளிடுங்கள்</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setQuote(null); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
                placeholder="எ.கா. PONNA-7K2M3"
                autoCapitalize="characters" autoComplete="off" spellCheck={false}
                style={{ flex: 1, minWidth: 0, padding: '12px 12px', fontSize: 16, letterSpacing: 1, border: `1px solid ${COLORS.line}`, borderRadius: 8, background: '#fff', color: '#0f172a' }}
              />
              <button onClick={() => check()} disabled={busy || !code.trim()} style={{ padding: '0 16px', border: 'none', borderRadius: 8, background: COLORS.head1, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy || !code.trim() ? 0.6 : 1 }}>
                சரிபார்
              </button>
            </div>
            {error && <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: 14 }}>{error}</p>}

            {quote && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
                <p style={{ margin: '0 0 4px', color: '#065f46', fontWeight: 700 }}>✅ குறியீடு ஏற்கப்பட்டது</p>
                <p style={{ margin: '0 0 2px', fontSize: 14, color: COLORS.inkMuted }}>{quote.planName}</p>
                <p style={{ margin: '6px 0' }}>
                  <span style={{ textDecoration: 'line-through', color: COLORS.inkMuted, marginRight: 8 }}>₹{quote.price}</span>
                  <span style={{ fontFamily: FONT_FAMILY, fontSize: 34, fontWeight: 800, color: COLORS.gold }}>₹{quote.finalAmount}</span>
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: COLORS.inkMuted }}>₹{quote.discount} தள்ளுபடி · இந்தக் குறியீடு {fmt(quote.expiresAt)} வரை செல்லும்</p>
                <button onClick={pay} disabled={busy} style={{ width: '100%', padding: '14px 16px', border: 'none', borderRadius: 10, background: '#FFD22A', color: '#0f172a', fontWeight: 800, fontSize: 17, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
                  {busy ? 'காத்திருங்கள்…' : `₹${quote.finalAmount} செலுத்துங்கள்`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
