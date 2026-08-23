'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { studentFetch } from '../../lib/student-fetch';

// Mode selection + session start, implementing §4.2 / §4.3, with §4.5 language
// toggle. On start, calls the backend which reserves quota and builds the
// session server-side (see allocation.service.ts).
//
// Session sizes not included in the student's plan are shown locked (per the
// agreed change) — a Free-plan student sees 20/50 blurred with an upgrade
// link rather than clicking them and only finding out via an error.

const SESSION_SIZES_BY_PLAN: Record<string, number[]> = {
  FREE: [5],
  PLAN_20: [5, 20],
  PLAN_50: [5, 20, 50],
};

export default function QuizStartPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'MIXED' | 'MEDIUM' | 'HARD'>('MIXED');
  const [error, setError] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string>('FREE');

  useEffect(() => {
    studentFetch('/students/me/profile')
      .then((r) => r.json())
      .then((profile) => setPlanCode(profile.planCode ?? 'FREE'))
      .catch(() => {});
  }, []);

  const unlockedSizes = SESSION_SIZES_BY_PLAN[planCode] ?? [5];

  async function startQuiz(sessionSize: number) {
    setError(null);
    const res = await studentFetch('/quiz/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, sessionSize }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? t.quiz.startError);
      return;
    }
    const session = await res.json();

    if (session.resumedWithDifferentSelection) {
      // §4.3: an in-progress session always wins — make that visible instead
      // of silently landing the student on a different mode/size than they
      // just picked.
      alert(t.quiz.resumingSession);
    } else if (session.shortfall > 0) {
      alert(
        t.quiz.modes[mode] +
          `: only ${session.totalQuestions} of ${session.requestedSize} questions were available right now.`,
      );
    }
    window.location.href = `/quiz/${session.id}`;
  }

  return (
    <main style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>{t.quiz.title}</h1>
        <LanguageToggle />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['MIXED', 'MEDIUM', 'HARD'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 8,
              border: mode === m ? '2px solid #0f172a' : '1px solid #cbd5e1',
              background: mode === m ? '#0f172a' : '#fff',
              color: mode === m ? '#fff' : '#0f172a',
            }}
          >
            {t.quiz.modes[m]}
          </button>
        ))}
      </div>

      {[5, 20, 50].map((size) => {
        const unlocked = unlockedSizes.includes(size);
        return unlocked ? (
          <button
            key={size}
            onClick={() => startQuiz(size)}
            style={{ width: '100%', padding: 12, marginBottom: 8, borderRadius: 8 }}
          >
            {t.quiz.startN(size)}
          </button>
        ) : (
          <a
            key={size}
            href="/plans"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              padding: 12,
              marginBottom: 8,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              color: '#94a3b8',
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            <span>{t.quiz.startN(size)}</span>
            <span style={{ fontSize: 12 }}>🔒 {t.quiz.upgradeToUnlock}</span>
          </a>
        );
      })}

      {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}
    </main>
  );
}
