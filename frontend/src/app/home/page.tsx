'use client';

// Home — the post-login landing page. No language selection here at all
// (finalized requirement): the Homepage itself always shows both Tamil and
// English together, and language becomes a student choice only inside
// Practice Preference Setup (Language is a question-content filter there,
// not a UI-wide toggle).
//
// "Start Practising" behaviour (finalized requirement):
//   - First-time student / no saved preference yet → go to /quiz, which
//     opens straight into Practice Preference Setup.
//   - Returning student with a saved preference → skip Setup entirely,
//     start a session immediately, and land directly on the first question.
// This is the ONLY place that decides which of those two happens — the
// student's saved preference is the single source of truth, checked fresh
// on every click rather than cached in the UI.

import { useState } from 'react';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';

export default function HomePage() {
  const [starting, setStarting] = useState(false);

  async function handleStartPractising() {
    setStarting(true);
    try {
      const prefRes = await studentFetch('/students/me/practice-preference');
      const preference = prefRes.ok ? await prefRes.json() : null;

      if (!preference) {
        window.location.href = '/quiz'; // no saved preference yet — Setup happens there
        return;
      }

      const sessionRes = await studentFetch('/quiz/start', { method: 'POST' });
      if (!sessionRes.ok) {
        // Quota exceeded, no eligible questions, etc. — let /quiz show the
        // specific error rather than duplicating that handling here.
        window.location.href = '/quiz';
        return;
      }
      const session = await sessionRes.json();
      window.location.href = `/quiz/${session.id}`;
    } finally {
      setStarting(false);
    }
  }

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
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32, lineHeight: 1.5 }}>
          A practice platform for competitive exam aspirants.
        </p>

        <button
          onClick={handleStartPractising}
          disabled={starting}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'center',
            padding: 16,
            borderRadius: 12,
            background: '#0f172a',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: 16,
            opacity: starting ? 0.7 : 1,
          }}
        >
          {starting ? '…' : 'பயிற்சியைத் தொடங்குங்கள் / Start Practising'}
        </button>
      </div>
    </main>
  );
}
