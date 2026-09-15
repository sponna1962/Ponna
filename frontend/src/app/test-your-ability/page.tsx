'use client';

// Test Your Ability (Sept 2026, Item 4) — signup-less guest diagnostic.
// See backend/src/modules/students/guest-diagnostic.service.ts's own
// header comment for the full design: no login required to start or
// answer, signup required only to see the report afterward. guestId is
// a client-generated UUID stored in localStorage, never a real userId.

import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api-config';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

const GUEST_ID_KEY = 'ponna_guest_diagnostic_id';

type Question = {
  sequenceNumber: number;
  questionId: string;
  answered: boolean;
  selectedOption: string | null;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

function getOrCreateGuestId(): string {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export default function TestYourAbilityPage() {
  const [stage, setStage] = useState<'intro' | 'quiz' | 'done'>('intro');
  const [guestId, setGuestId] = useState<string | null>(null);
  const [examName, setExamName] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/public/primary-exam'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setExamName(data?.name ?? null))
      .catch(() => setExamName(null));

    // If a diagnostic was already started on this device (page reload,
    // came back later), resume it rather than starting a fresh one.
    const existingId = localStorage.getItem(GUEST_ID_KEY);
    if (existingId) {
      setGuestId(existingId);
      loadQuestions(existingId);
    }
  }, []);

  function loadQuestions(id: string) {
    fetch(apiUrl(`/guest-diagnostic/${id}/questions`))
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Question[]) => {
        if (data.length === 0) return;
        setQuestions(data);
        const firstUnanswered = data.findIndex((q) => !q.answered);
        if (firstUnanswered === -1) {
          setStage('done');
        } else {
          setCurrentIndex(firstUnanswered);
          setStage('quiz');
        }
      })
      .catch(() => {});
  }

  async function start() {
    setError(null);
    setStarting(true);
    try {
      const res = await fetch(apiUrl('/public/primary-exam'));
      const exam = await res.json().catch(() => null);
      if (!res.ok || !exam?.id) throw new Error('No exam is currently available.');

      const id = getOrCreateGuestId();
      setGuestId(id);
      const startRes = await fetch(apiUrl('/guest-diagnostic/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: id, subCategoryId: exam.id }),
      });
      if (!startRes.ok) {
        const body = await startRes.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to start');
      }
      loadQuestions(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  async function selectOption(letter: string) {
    if (!guestId || submitting) return;
    const q = questions[currentIndex];
    if (q.answered) return;
    setSubmitting(true);
    setQuestions((qs) => qs.map((x, i) => (i === currentIndex ? { ...x, answered: true, selectedOption: letter } : x)));
    try {
      const res = await fetch(apiUrl(`/guest-diagnostic/${guestId}/answer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.questionId, selectedOption: letter }),
      });
      const body = await res.json();
      setLastCorrect(body.isCorrect ?? null);
    } finally {
      setSubmitting(false);
    }
  }

  async function next() {
    setLastCorrect(null);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (guestId) {
      await fetch(apiUrl(`/guest-diagnostic/${guestId}/complete`), { method: 'POST' });
      setStage('done');
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', padding: 20, background: COLORS.paper, color: COLORS.ink }}>
      <BitterFontLinks />
      <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 800, marginBottom: 16 }}>உங்க திறமையை பரிசோதிப்போம்!</h1>

      {stage === 'intro' && (
        <div style={{ textAlign: 'center', paddingTop: 24 }}>
          <p style={{ fontSize: 15, color: COLORS.inkMuted, marginBottom: 8, lineHeight: 1.6 }}>
            {examName ?? 'உங்க தேர்வுக்கான'} தயார்நிலையை இப்போவே பார்க்கலாம் — **Sign up தேவையில்லை**.
          </p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 24, lineHeight: 1.6 }}>15 கேள்விகள் · சுமார் 10 நிமிடங்கள் · உடனடி result</p>
          {error && <p style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button
            onClick={start}
            disabled={starting}
            style={{ padding: '14px 32px', borderRadius: 12, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            {starting ? '…' : 'தொடங்குங்கள்'}
          </button>
        </div>
      )}

      {stage === 'quiz' && questions[currentIndex] && (
        <div>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 12 }}>
            {currentIndex + 1} / {questions.length}
          </p>
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{questions[currentIndex].questionText}</p>

          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const q = questions[currentIndex];
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const isSelected = q.selectedOption === letter;
            return (
              <div
                key={letter}
                onClick={() => selectOption(letter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  border: `1.5px solid ${isSelected ? COLORS.ink : COLORS.line}`,
                  borderRadius: 10,
                  marginBottom: 8,
                  fontSize: 14,
                  cursor: q.answered ? 'default' : 'pointer',
                  background: isSelected ? COLORS.paperAlt : COLORS.paper,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.inkMuted }}>{letter}.</span>
                <span style={{ flex: 1 }}>{text}</span>
              </div>
            );
          })}

          {questions[currentIndex].answered && (
            <>
              {lastCorrect !== null && (
                <p style={{ fontSize: 13, fontWeight: 700, color: lastCorrect ? '#166534' : '#B4544A', marginBottom: 8 }}>{lastCorrect ? '✓ சரி!' : '✕ தப்பு'}</p>
              )}
              <button onClick={next} style={{ display: 'block', width: '100%', padding: 14, borderRadius: 10, border: 'none', background: COLORS.ink, color: COLORS.paper, fontWeight: 700, marginTop: 8, cursor: 'pointer' }}>
                {currentIndex < questions.length - 1 ? 'அடுத்தது' : 'முடிக்க'}
              </button>
            </>
          )}
        </div>
      )}

      {stage === 'done' && (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🎉</p>
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>உங்க Result தயார்!</p>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, marginBottom: 24, lineHeight: 1.6 }}>
            முழு report-ஐ (subject-வாரியான breakdown) பார்க்க, ஒரு free account உருவாக்குங்க — உங்க இப்போதைய results அப்படியே காப்பாற்றப்படும்.
          </p>
          <a
            href="/"
            style={{ display: 'block', padding: 14, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 700 }}
          >
            Sign up பண்ணி Result பாருங்க
          </a>
        </div>
      )}
    </main>
  );
}
