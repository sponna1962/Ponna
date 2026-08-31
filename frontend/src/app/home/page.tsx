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

  useEffect(() => {
    studentFetch('/students/me/subscriptions')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setActiveSubs(Array.isArray(data) ? data : []))
      .catch(() => setActiveSubs([]));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <strong style={{ fontSize: 16 }}>PONNA.in</strong>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, marginBottom: 4, whiteSpace: 'pre-line' }}>
          வெற்றியின்{'\n'}முதல் படி.
        </h1>
        <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, whiteSpace: 'pre-line', color: '#334155' }}>
          The first step{'\n'}to success.
        </h1>

        <p style={{ fontSize: 15, color: '#475569', marginBottom: 4, lineHeight: 1.5 }}>
          போட்டித் தேர்வுகளுக்கு தயாராகும் மாணவர்களுக்கான பயிற்சி இணையதளம்.
        </p>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
          A practice platform for competitive exam aspirants.
        </p>

        {/* Compact plan-status summary — one glance, no clutter. Loading
            state is silent (no spinner/flash) since this is secondary
            information; the CTA below is never blocked by it. */}
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
        {activeSubs && activeSubs.length === 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 20, background: '#f8fafc' }}>
            <p style={{ fontSize: 13, color: '#64748b' }}>Free Practice — 5 Questions / Day</p>
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
