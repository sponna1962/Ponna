'use client';

import { useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { LanguageToggle } from '../../components/LanguageToggle';
import { apiUrl } from '../../lib/api-config';

// Mode selection + session start, implementing §4.2 / §4.3, with §4.5 language
// toggle. On start, calls the backend which reserves quota and builds the
// session server-side (see allocation.service.ts).

export default function QuizStartPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'MIXED' | 'MEDIUM' | 'HARD'>('MIXED');
  const [error, setError] = useState<string | null>(null);

  async function startQuiz(sessionSize: number) {
    setError(null);
    const res = await fetch(apiUrl('/quiz/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'demo-user', mode, sessionSize }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? t.quiz.startError);
      return;
    }
    const session = await res.json();
    if (session.shortfall > 0) {
      // Still proceed — just let the student know before they land on question 1.
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

      {[5, 20, 50].map((size) => (
        <button
          key={size}
          onClick={() => startQuiz(size)}
          style={{ width: '100%', padding: 12, marginBottom: 8, borderRadius: 8 }}
        >
          {t.quiz.startN(size)}
        </button>
      ))}

      {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}
    </main>
  );
}
