'use client';

import { useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { StudentMenu } from '../../components/StudentMenu';
import { studentFetch } from '../../lib/student-fetch';

// Simplified quiz flow (finalized requirement): the student picks ONLY a
// mode (Mixed/Medium/Hard) — no session-size selection, no "Start" button,
// no upfront lock/upgrade messaging. Tapping a mode starts the session
// immediately. The backend automatically sizes the session to whatever the
// student's remaining quota allows (see session.service.ts) — Free students
// naturally get fewer questions as they use up today's limit, Test Accounts
// get unlimited, and the Plan/Upgrade prompt only appears once quota is
// actually exhausted (via the QuotaExceededError message shown below).
//
// Deliberately does NOT auto-start on page load, even with a mode visually
// highlighted as the default — starting a session reserves quota immediately,
// and that shouldn't happen just because the student opened this page.

export default function QuizStartPage() {
  const { t } = useLanguage();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startQuiz(mode: 'MIXED' | 'MEDIUM' | 'HARD') {
    setError(null);
    setStarting(true);
    try {
      const res = await studentFetch('/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? t.quiz.startError);
        return;
      }
      const session = await res.json();

      if (session.resumedWithDifferentSelection) {
        // §4.3: an in-progress session always wins — make that visible
        // instead of silently landing the student on a different mode.
        alert(t.quiz.resumingSession);
      }
      window.location.href = `/quiz/${session.id}`;
    } finally {
      setStarting(false);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <StudentMenu />
          <h1 style={{ fontSize: 20, margin: 0 }}>{t.quiz.title}</h1>
        </div>
        <LanguageToggle />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['MIXED', 'MEDIUM', 'HARD'] as const).map((m) => (
          <button
            key={m}
            onClick={() => startQuiz(m)}
            disabled={starting}
            style={{
              flex: 1,
              padding: 14,
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#0f172a',
              fontSize: 15,
              opacity: starting ? 0.6 : 1,
            }}
          >
            {t.quiz.modes[m]}
          </button>
        ))}
      </div>

      {starting && <p style={{ marginTop: 16, color: '#64748b', fontSize: 13 }}>{t.quiz.loading}</p>}
      {error && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: '#dc2626', marginBottom: 8 }}>{error}</p>
          <a
            href="/plans"
            style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 6, background: '#0f172a', color: '#fff', textDecoration: 'none', fontSize: 13 }}
          >
            {t.dashboard.upgrade}
          </a>
        </div>
      )}
    </main>
  );
}
