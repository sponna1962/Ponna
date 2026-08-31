'use client';

// Home — the post-login landing page. No language selection here at all
// (finalized requirement): the Homepage itself always shows both Tamil and
// English together, and language becomes a student choice only inside
// Practice Preference Setup.
//
// "Start Practising" ALWAYS goes to /quiz (finalized requirement — no
// silent skip-straight-to-questions from here, even for a returning
// student with a saved preference). /quiz itself decides what to show:
// the full Setup form for a first-time student, or a Preferences summary
// + "Start Practice" button for a returning one — so the student always
// sees and confirms what they're about to practice before it starts.
//
// A compact Active Plans summary sits above the CTA (finalized requirement
// — "immediately understand what plan(s) they have, expiry, what they can
// practice") — deliberately just names + expiry dates, not a full My Plans
// page dump, to keep this first screen uncluttered.

import { useEffect, useState } from 'react';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

type ActiveSubscription = {
  id: string;
  cycleEnd: string;
  plan: { name: string; nameTa: string | null };
};

export default function HomePage() {
  const [activeSubs, setActiveSubs] = useState<ActiveSubscription[] | null>(null);
  // Just enough of Profile to decide which login-method icon to show — not
  // used for anything else here (full Profile lives on its own page).
  const [loginMethod, setLoginMethod] = useState<'phone' | 'google' | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    studentFetch('/students/me/subscriptions')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setActiveSubs(Array.isArray(data) ? data : []))
      .catch(() => setActiveSubs([]));

    studentFetch('/students/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLoginMethod(data?.phone ? 'phone' : data?.email ? 'google' : null))
      .catch(() => {});
  }, []);

  function logout() {
    localStorage.removeItem('ponna_student_token');
    window.location.href = '/';
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <strong style={{ fontSize: 16 }}>PONNA.in</strong>
        </div>

        {/* Small account indicator — shows HOW this student is logged in
            (Google vs Phone), and doubles as the Logout control right here
            (in addition to the ☰ menu's Logout, for a one-tap option from
            the very first screen). Purely a display + logout affordance —
            never a "click to log in" control, since seeing it at all means
            the student already IS logged in. */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setAccountMenuOpen((o) => !o)}
            aria-label="Account"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '1px solid #cbd5e1',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            {loginMethod === 'google' ? <GoogleIcon /> : '📱'}
          </button>

          {accountMenuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 44,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                minWidth: 140,
                zIndex: 10,
              }}
            >
              <button
                onClick={logout}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: 14,
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, marginBottom: 4, whiteSpace: 'pre-line' }}>
          வெற்றியின்{'\n'}முதல் படி.
        </h1>
        <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, whiteSpace: 'pre-line', color: '#334155' }}>
          The first step{'\n'}to success.
        </h1>

        <p style={{ fontSize: 15, color: '#475569', marginBottom: 4, lineHeight: 1.5 }}>
          போட்டித் தேர்வுகள் மற்றும் நுழைவுத் தேர்வுகளுக்கான பயிற்சி இணையதளம்.
        </p>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
          A practice platform for competitive and entrance exam aspirants.
        </p>

        {/* Compact plan-status summary — one glance, no clutter. Loading
            state is silent (no spinner/flash) since this is secondary
            information; the CTA below is never blocked by it. No card at
            all when there are no active plans — the Free 5/day message
            belongs only after the student has actually used up their free
            questions and lands on the Annual Plans page, never here. */}
        {activeSubs && activeSubs.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 20, background: '#f8fafc' }}>
            <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              செயலில் உள்ள திட்டங்கள் / Active Plans
            </p>
            {activeSubs.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{s.plan.name}</span>
                <span style={{ color: '#64748b' }}>{new Date(s.cycleEnd).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        <a
          href="/quiz"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: 16,
            borderRadius: 12,
            background: '#0f172a',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          பயிற்சியைத் தொடங்குங்கள் / Start Practising
        </a>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.05l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
