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

  const card: React.CSSProperties = { background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: `4px solid ${COLORS.gold}`, borderRadius: 16, padding: '22px 18px', textAlign: 'center' };
  const bigBtn: React.CSSProperties = { width: '100%', padding: 15, borderRadius: 14, background: COLORS.btn, color: COLORS.btnText, border: 'none', fontWeight: 700, fontSize: 16, textDecoration: 'none', display: 'block', boxSizing: 'border-box', textAlign: 'center' };
  const chipStyle: React.CSSProperties = { padding: '6px 12px', borderRadius: 999, background: COLORS.field, border: `1px solid ${COLORS.line}`, fontSize: 12.5, fontWeight: 700, color: COLORS.inkMuted };
  const cur = questions && questions[currentIndex];
  const inQuiz = state?.access === 'IN_PROGRESS' && !!cur && !result;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink, paddingBottom: inQuiz ? 96 : 24 }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: `linear-gradient(180deg, ${COLORS.head1}, ${COLORS.head2})`, borderBottom: `3px solid #E2B04A`, color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>Adaptive Mock Test</h1>
      </div>
      <div style={{ padding: 16 }}>

      {!state && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state?.access === 'FREE_LOCKED' && (
        <div style={card}>
          <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, margin: '0 0 16px' }}>🔒 Annual Plan தேவை</p>
          <a href="/plans" style={bigBtn}>{t.dailyQuiz.viewPlans}</a>
        </div>
      )}

      {state?.access === 'NO_PREFERENCE' && (
        <div style={card}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>முதலில் Practice Setup-ஐ முடியுங்க.</p>
          <a href="/quiz" style={{ ...bigBtn, marginTop: 16 }}>Practice Setup →</a>
        </div>
      )}

      {state?.access === 'READY' && !result && (
        <div style={card}>
          <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink, margin: '0 0 12px' }}>உங்க level-க்கு ஏத்த Mock Test</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <span style={chipStyle}>20 questions</span>
            <span style={chipStyle}>25 minutes</span>
            <span style={chipStyle}>immediate feedback</span>
          </div>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, margin: '0 0 18px', lineHeight: 1.6 }}>
            உங்க recent accuracy-ஐ பார்த்து, Medium/Hard mix தானாக adjust ஆகும்.
          </p>
          <button onClick={start} disabled={starting} style={bigBtn}>
            {starting ? '…' : 'Start Adaptive Mock'}
          </button>
        </div>
      )}

      {inQuiz && cur && questions && (
        <div>
          <div style={{ fontSize: 14, color: COLORS.inkMuted, fontWeight: 700, marginBottom: 10 }}>
            {currentIndex + 1} / {questions.length}
          </div>
          <div style={{ height: 8, background: COLORS.line, borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${((currentIndex + 1) / questions.length) * 100}%`, background: 'linear-gradient(90deg,#E2B04A,#D99A1E)' }} />
          </div>
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderTop: `4px solid ${COLORS.gold}`, borderRadius: 16, padding: 18, fontSize: cur.questionText.length > 140 ? 16.5 : 17.5, fontWeight: 600, color: COLORS.ink, lineHeight: 1.7, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{cur.questionText}</div>

          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const q = cur;
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const isSelected = q.selectedOption === letter;
            const showRes = isSelected && lastAnswerCorrect !== null;
            const good = showRes && lastAnswerCorrect;
            const badSel = showRes && !lastAnswerCorrect;
            const accent = good ? COLORS.ok : badSel ? COLORS.bad : isSelected ? COLORS.gold : COLORS.line;
            return (
              <div
                key={letter}
                onClick={() => !q.selectedOption && selectOption(q.questionId, letter)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  border: `1.5px solid ${accent}`, borderRadius: 14, marginBottom: 10, fontSize: 15.5,
                  cursor: q.selectedOption ? 'default' : 'pointer',
                  background: good ? COLORS.okBg : badSel ? COLORS.badBg : COLORS.card,
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5, background: good ? COLORS.ok : badSel ? COLORS.bad : COLORS.field, border: `1.5px solid ${good ? COLORS.ok : badSel ? COLORS.bad : COLORS.line}`, color: showRes ? '#fff' : COLORS.inkMuted }}>
                  {good ? '✓' : badSel ? '✕' : letter}
                </span>
                <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
              </div>
            );
          })}

          {cur.selectedOption && lastAnswerCorrect !== null && (
            <div style={{ padding: '10px 14px', borderRadius: 12, fontWeight: 700, fontSize: 14.5, background: lastAnswerCorrect ? COLORS.okBg : COLORS.badBg, color: lastAnswerCorrect ? COLORS.ok : COLORS.bad }}>
              {lastAnswerCorrect ? '✓ சரி!' : '✕ தப்பு'}
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={card}>
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 42, fontWeight: 800, color: COLORS.gold, margin: '8px 0 4px' }}>
            {result.score} / {result.totalMarks}
          </p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, margin: '0 0 22px' }}>Adaptive Mock முடிஞ்சுது!</p>
          <a href="/" style={bigBtn}>{t.dailyQuiz.backHome}</a>
        </div>
      )}
      </div>

      {inQuiz && questions && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto', display: 'flex', gap: 10, padding: '14px 16px 16px', background: `linear-gradient(transparent, ${COLORS.paper} 40%)` }}>
          <button
            onClick={() => { setLastAnswerCorrect(null); setCurrentIndex(Math.max(0, currentIndex - 1)); }}
            disabled={currentIndex === 0}
            style={{ flex: 1, padding: 15, borderRadius: 14, border: `1.5px solid ${COLORS.line}`, background: COLORS.card, color: COLORS.ink, fontWeight: 700, fontSize: 15.5, opacity: currentIndex === 0 ? 0.5 : 1 }}
          >
            Previous
          </button>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => { setLastAnswerCorrect(null); setCurrentIndex(currentIndex + 1); }}
              style={{ flex: 1, padding: 15, borderRadius: 14, border: 'none', background: COLORS.btn, color: COLORS.btnText, fontWeight: 700, fontSize: 15.5 }}
            >
              Next
            </button>
          ) : (
            <button onClick={finishAttempt} style={{ flex: 1, padding: 15, borderRadius: 14, border: 'none', background: COLORS.btn, color: COLORS.btnText, fontWeight: 700, fontSize: 15.5 }}>
              Finish
            </button>
          )}
        </div>
      )}
    </main>
  );
}
