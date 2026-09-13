'use client';

// Adaptive Mock Test (Sept 2026, differentiated feature — Item 5). See
// schema.prisma's own header comment on AdaptiveMockAttempt for why
// this is deliberately separate from Live Exam: a repeatable, any-time
// skill-building tool whose MEDIUM:HARD mix adapts to the student's own
// recent accuracy, with immediate per-answer feedback (unlike Live
// Exam, which withholds feedback to match the real exam). No exam
// picker needed — auto-resolves from the student's saved Practice
// Preference, same as the Weak-Area/Progress-Coach cards.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type State =
  | { access: 'FREE_LOCKED' }
  | { access: 'NO_PREFERENCE' }
  | { access: 'READY'; subCategoryId: string }
  | { access: 'IN_PROGRESS'; attemptId: string; expiresAt: string };

type Question = {
  questionId: string;
  sequenceNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string | null;
};

export default function AdaptiveMockPage() {
  const { t } = useLanguage();
  const [state, setState] = useState<State | null>(null);
  const [starting, setStarting] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<{ score: number; totalMarks: number } | null>(null);

  function loadState() {
    studentFetch('/adaptive-mock/state')
      .then((r) => r.json())
      .then((s: State) => {
        setState(s);
        if (s.access === 'IN_PROGRESS') loadQuestions(s.attemptId);
      });
  }

  useEffect(loadState, []);

  function loadQuestions(attemptId: string) {
    studentFetch(`/adaptive-mock/attempts/${attemptId}/questions`)
      .then((r) => r.json())
      .then((data: Question[]) => {
        setQuestions(data);
        const firstUnanswered = data.findIndex((q) => !q.selectedOption);
        setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
      });
  }

  async function start() {
    setStarting(true);
    const res = await studentFetch('/adaptive-mock/start', { method: 'POST' });
    setStarting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? 'Failed to start Adaptive Mock Test');
      return;
    }
    loadState();
  }

  async function selectOption(questionId: string, option: string) {
    if (!questions || (state as any)?.attemptId === undefined) return;
    setQuestions(questions.map((q) => (q.questionId === questionId ? { ...q, selectedOption: option } : q)));
    const res = await studentFetch(`/adaptive-mock/attempts/${(state as any).attemptId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedOption: option }),
    });
    const body = await res.json();
    // Sept 2026 — unlike Live Exam, Adaptive Mock shows immediate
    // correctness feedback: it's a skill-building tool, not an exam
    // simulation, so the same immediate-feedback pedagogy normal
    // Practice already uses fits it better.
    setLastAnswerCorrect(body.isCorrect ?? null);
  }

  async function finishAttempt() {
    if (!questions) return;
    const attemptId = (state as any).attemptId;
    const res = await studentFetch(`/adaptive-mock/attempts/${attemptId}/complete`, { method: 'POST' });
    const body = await res.json();
    setResult({ score: body.score, totalMarks: body.totalMarks });
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>Adaptive Mock Test</h1>
      </div>

      {!state && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state?.access === 'FREE_LOCKED' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 14, padding: 24, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 Annual Plan தேவை</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {state?.access === 'NO_PREFERENCE' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>முதலில் Practice Setup-ஐ முடியுங்க.</p>
          <a href="/quiz" style={{ display: 'inline-block', marginTop: 12, color: COLORS.gold, fontWeight: 600, fontSize: 13 }}>
            Practice Setup →
          </a>
        </div>
      )}

      {state?.access === 'READY' && !result && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 8 }}>உங்க level-க்கு ஏத்த Mock Test</p>
          <p style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
            உங்க recent accuracy-ஐ பார்த்து, Medium/Hard mix தானாக adjust ஆகும் — 20 questions, 25 minutes, immediate feedback.
          </p>
          <button onClick={start} disabled={starting} style={{ padding: '12px 28px', borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600 }}>
            {starting ? '…' : 'Start Adaptive Mock'}
          </button>
        </div>
      )}

      {state?.access === 'IN_PROGRESS' && questions && questions[currentIndex] && !result && (
        <div>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 12 }}>
            {currentIndex + 1} / {questions.length}
          </p>
          <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{questions[currentIndex].questionText}</p>

          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const q = questions[currentIndex];
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const isSelected = q.selectedOption === letter;
            return (
              <div
                key={letter}
                onClick={() => !q.selectedOption && selectOption(q.questionId, letter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  border: `1.5px solid ${isSelected ? COLORS.ink : COLORS.line}`,
                  borderRadius: 10,
                  marginBottom: 8,
                  fontSize: 14,
                  cursor: q.selectedOption ? 'default' : 'pointer',
                  background: isSelected ? COLORS.paperAlt : COLORS.paper,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.inkMuted }}>{letter}.</span>
                <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
              </div>
            );
          })}

          {questions[currentIndex].selectedOption && lastAnswerCorrect !== null && (
            <p style={{ fontSize: 13, fontWeight: 700, color: lastAnswerCorrect ? '#166534' : '#B4544A', marginBottom: 8 }}>
              {lastAnswerCorrect ? '✓ சரி!' : '✕ தப்பு'}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => {
                setLastAnswerCorrect(null);
                setCurrentIndex(Math.max(0, currentIndex - 1));
              }}
              disabled={currentIndex === 0}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.line}`, background: COLORS.paper, color: COLORS.ink }}
            >
              Previous
            </button>
            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => {
                  setLastAnswerCorrect(null);
                  setCurrentIndex(currentIndex + 1);
                }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: COLORS.ink, color: COLORS.paper, fontWeight: 600 }}
              >
                Next
              </button>
            ) : (
              <button onClick={finishAttempt} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#166534', color: '#fff', fontWeight: 600 }}>
                Finish
              </button>
            )}
          </div>
        </div>
      )}

      {result && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 42, fontWeight: 800, color: COLORS.gold, margin: '20px 0 4px' }}>
            {result.score} / {result.totalMarks}
          </p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 24 }}>Adaptive Mock முடிஞ்சுது!</p>
          <a href="/" style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600 }}>
            {t.dailyQuiz.backHome}
          </a>
        </div>
      )}
    </main>
  );
}
