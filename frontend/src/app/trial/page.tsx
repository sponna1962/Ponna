'use client';

// ₹10 – 3 நாள் சோதனை landing page (Oct 2026). Reached from the home-page
// stamp/bar, the Plans page and the menu. The trial plan itself is a normal
// Plan row with isTrial = true (seeded); this page just explains it and sends
// the student to PayU for that plan. Live Exam / Adaptive Mock / Ask Ponna
// chat stay locked server-side for trial-only students.

import { useEffect, useState } from 'react';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type TrialPlan = { id: string; name: string; regularPrice: string | null; launchPrice: string | null; isTrial?: boolean; active: boolean };
type Sub = { id: string; planId: string; validUntil: string; plan: { isTrial?: boolean } };

const GIVES: { icon: string; title: string; body: string }[] = [
  { icon: '📝', title: '60,000+ பயிற்சிக் கேள்விகள்', body: 'பாடவாரியாக, "ஏன் இது சரி?" விளக்கத்துடன்' },
  { icon: '📘', title: 'Study Notes', body: 'தமிழ் & English குறிப்புகள்' },
  { icon: '🗓️', title: 'Daily Quiz', body: 'தினமும் புதிய வினாடி வினா' },
  { icon: '🔁', title: 'தவறுகள் மறுபார்வை', body: 'தவறிய கேள்விகளை மீண்டும் பயிலுங்கள்' },
  { icon: '🧭', title: 'திறனறிவுச் சோதனை', body: 'உங்கள் நிலையை அறியுங்கள்' },
];

const FAQ: { q: string; a: string }[] = [
  { q: '₹10 சோதனையில் என்ன கிடைக்கும்?', a: 'பயிற்சி, "ஏன் இது சரி?" விளக்கங்கள், Study Notes, Daily Quiz, தவறுகள் மறுபார்வை, திறனறிவுச் சோதனை — 3 நாள்களுக்கு.' },
  { q: '3 நாளுக்குப் பிறகு பணம் எடுக்கப்படுமா?', a: 'இல்லை. தானாகப் பணம் எடுக்கப்படாது. தொடர்ந்து படிக்க விரும்பினால் நீங்களே ₹499 Pass வாங்கலாம். ₹10 அதில் கழிக்கப்படாது.' },
  { q: 'ஒருவர் எத்தனை முறை சேரலாம்?', a: 'ஒரு கணக்குக்கு ஒரு முறை மட்டும்.' },
  { q: '₹499 Pass-இல் கூடுதலாக என்ன?', a: 'Live Exam, Adaptive Mock தேர்வுகள், Ask PONNA அரட்டை — மேலும் Pass காலம் முழுவதும் (ஜன. 12, 2027 வரை) பயிற்சி.' },
];

export default function TrialPage() {
  const [plan, setPlan] = useState<TrialPlan | null>(null);
  const [passPlan, setPassPlan] = useState<TrialPlan | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(0);
  const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ponna_student_token');

  useEffect(() => {
    if (!localStorage.getItem('ponna_student_token')) { setLoaded(true); return; }
    Promise.all([
      studentFetch('/plans').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      studentFetch('/students/me/subscriptions').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([plans, mine]: [TrialPlan[], Sub[]]) => {
      setPlan(plans.find((p) => p.isTrial && p.active) ?? null);
      setPassPlan(plans.find((p) => !p.isTrial && !(p as any).isFree && p.active && (p as any).restrictToScope) ?? null);
      setSubs(mine);
    }).finally(() => setLoaded(true));
  }, []);

  const trialSub = subs.find((s) => s.plan.isTrial);
  const hasPass = subs.some((s) => !s.plan.isTrial);

  async function start(target: TrialPlan | null = plan) {
    setError('');
    if (!loggedIn) { window.location.href = '/?startLogin=1'; return; }
    if (!target) return;
    setBusy(true);
    try {
      const res = await studentFetch('/payments/payu/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId: target.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'பணம் செலுத்த முடியவில்லை. மீண்டும் முயலவும்.');
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
    } catch (e: any) {
      setError(e.message ?? 'பணம் செலுத்த முடியவில்லை.');
      setBusy(false);
    }
  }

  const ctaLabel = trialSub ? 'பயிற்சியைத் தொடருங்கள்' : hasPass ? 'உங்களிடம் Pass உள்ளது' : busy ? 'காத்திருக்கவும்…' : '3 நாள் சோதனை தொடங்கு | ₹10';
  const ctaDisabled = busy || hasPass || (loggedIn && loaded && !plan && !trialSub);
  function onCta() {
    if (trialSub) { window.location.href = '/quiz'; return; }
    start();
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', background: '#F6F7FB', minHeight: '100dvh', color: COLORS.ink, paddingBottom: 130 }}>
      <BitterFontLinks />
      <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>₹10 சோதனை</h1>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ background: '#fff', border: '1px solid #e8e8ee', borderRadius: 18, padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 800 }}>TNPSC Group 4 — முழு பயிற்சி</div>
          <div style={{ color: '#777', margin: '6px 0 2px', fontSize: 14 }}>வெறும்</div>
          <div style={{ fontSize: 72, fontWeight: 900, color: '#D02B2B', lineHeight: 1 }}>₹10</div>
          <div style={{ fontWeight: 800, marginTop: 6, fontSize: 16 }}>3 நாள் சோதனை</div>
          <span style={{ display: 'inline-block', border: '1px solid #bbb', borderRadius: 16, padding: '3px 12px', fontSize: 12, margin: '8px 0 4px' }}>● ஒரு முறை மட்டும்</span>
          <div style={{ color: '#888', fontSize: 12.5 }}>தானாகப் பணம் எடுக்கப்படாது</div>
        </div>

        {trialSub && (
          <div style={{ marginTop: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 12, padding: 12, fontSize: 13.5 }}>
            உங்கள் சோதனை செயலில் உள்ளது — {new Date(trialSub.validUntil).toLocaleDateString('en-IN')} வரை.
          </div>
        )}

        <h2 style={{ textAlign: 'center', fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 800, margin: '22px 0 10px' }}>சோதனையில் இவை உண்டு</h2>
        <div style={{ background: '#fff', border: '1px solid #e8e8ee', borderRadius: 14, overflow: 'hidden' }}>
          {GIVES.map((g, i) => (
            <div key={g.title} style={{ display: 'flex', gap: 12, padding: '12px 14px', borderTop: i ? '1px solid #f0f0f4' : 'none' }}>
              <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 10, background: '#fdecec', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 18 }}>{g.icon}</span>
              <div><div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.title}</div><div style={{ fontSize: 13, color: '#666' }}>{g.body}</div></div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderTop: '1px solid #f0f0f4', color: '#999' }}>
            <span aria-hidden="true" style={{ width: 38, height: 38, borderRadius: 10, background: '#eee', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 18 }}>🔒</span>
            <div><div style={{ fontWeight: 700, fontSize: 14.5 }}>Live Exam • Adaptive Mock • AI அரட்டை</div><div style={{ fontSize: 13 }}>₹499 Pass-இல் மட்டும்</div></div>
          </div>
        </div>

        <h2 style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 800, margin: '24px 0 8px' }}>அடிக்கடி கேட்கப்படும் கேள்விகள்</h2>
        <div style={{ background: '#fff', border: '1px solid #e8e8ee', borderRadius: 14 }}>
          {FAQ.map((f, i) => (
            <div key={f.q} style={{ borderTop: i ? '1px solid #f0f0f4' : 'none' }}>
              <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '13px 14px', fontWeight: 700, fontSize: 14, color: COLORS.ink, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                <span>{f.q}</span><span style={{ color: '#D02B2B' }}>{open === i ? '⌃' : '⌄'}</span>
              </button>
              {open === i && <p style={{ margin: 0, padding: '0 14px 14px', fontSize: 13.5, color: '#555', lineHeight: 1.65 }}>{f.a}</p>}
            </div>
          ))}
        </div>

        {passPlan && !hasPass && (
          <div style={{ marginTop: 22, background: '#fff', border: '2px solid #E2B04A', borderRadius: 16, padding: 16 }}>
            <div style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 800 }}>முழு Pass — தேர்வு வரை</div>
            <div style={{ fontSize: 13, color: '#666', margin: '4px 0 10px' }}>Live Exam, Adaptive Mock, Ask PONNA அரட்டை உட்பட எல்லாம் — ஜன. 12, 2027 வரை.</div>
            <div style={{ background: '#FFF0C2', borderRadius: 10, padding: '8px 12px', fontSize: 13, color: '#555' }}><b style={{ fontSize: 26, color: '#B07A16' }}>₹{Number(passPlan.launchPrice ?? passPlan.regularPrice ?? 499)}</b> ஒரு முறை</div>
            <button onClick={() => start(passPlan)} disabled={busy} style={{ width: '100%', marginTop: 12, padding: 13, border: 'none', borderRadius: 9, background: '#0B3864', color: '#FFD22A', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{busy ? 'காத்திருக்கவும்…' : '₹499 Pass பெறு'}</button>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', background: '#fff', borderTop: '1px solid #ddd', padding: '10px 14px 14px', zIndex: 40 }}>
        {error && <div style={{ color: '#991b1b', fontSize: 12.5, textAlign: 'center', marginBottom: 6 }}>{error}</div>}
        <button onClick={onCta} disabled={ctaDisabled} style={{ width: '100%', padding: 14, border: 'none', borderRadius: 10, background: ctaDisabled ? '#9bbfa9' : '#2E9E55', color: '#fff', fontWeight: 800, fontSize: 16, cursor: ctaDisabled ? 'default' : 'pointer' }}>{ctaLabel}</button>
        <div style={{ textAlign: 'center', color: '#666', fontSize: 11.5, marginTop: 6 }}>UPI / Card / Net Banking • PayU பாதுகாப்பான பணம் செலுத்தல் • ஒரு கணக்குக்கு ஒரு முறை</div>
      </div>
    </main>
  );
}
