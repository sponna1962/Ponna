'use client';

// Diagnostic Quiz at Signup (finalized requirement — world-class
// onboarding polish). Short (12-question), mixed-subject sample, once,
// entirely skippable. Immediate reveal (Daily-Quiz style) since this is
// a friendly onboarding moment, not a proctored assessment. Result is
// explicitly framed as a rough starting impression, never a trustworthy
// "accuracy" figure -- completely separate from normal Practice/ranking.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Question = {
  id: string;
  sequenceNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answered: boolean;
  selectedOption: string | null;
  correctOption: string | null;
  subjectName: string | null;
};

type Summary = { totalCorrect: number; totalQuestions: number; bySubject: { subject: string; correct: number; total: number }[] };

export default function DiagnosticPage() {
  const { t } = useLanguage();
  const [state, setState] = useState<'loading' | 'intro' | 'in_progress' | 'completed'>('loading');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    studentFetch('/diagnostic/state')
      .then((r) => r.json())
      .then((s) => {
        if (s.access === 'NOT_STARTED') setState('intro');
        else if (s.access === 'IN_PROGRESS') {
          setAttemptId(s.attemptId);
          loadQuestions(s.attemptId);
        } else {
          setState('completed');
        }
      });
  }, []);

  function loadQuestions(id: string) {
    studentFetch(`/diagnostic/attempts/${id}/questions`)
      .then((r) => r.json())
      .then((qs: Question[]) => {
        setQuestions(qs);
        const firstUnanswered = qs.findIndex((q) => !q.answered);
        setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
        setState('in_progress');
      });
  }

  async function start() {
    setStarting(true);
    const res = await studentFetch('/diagnostic/start', { method: 'POST' });
    setStarting(false);
    if (!res.ok) return;
    const body = await res.json();
    setAttemptId(body.attemptId);
    loadQuestions(body.attemptId);
  }

  async function selectOption(option: string) {
    if (!questions || !attemptId) return;
    const q = questions[currentIndex];
    if (q.answered) return;
    const res = await studentFetch(`/diagnostic/attempts/${attemptId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, selectedOption: option }),
    });
    const answer = await res.json();
    setQuestions(questions.map((qq, i) => (i === currentIndex ? { ...qq, answered: true, selectedOption: option, correctOption: answer.correctOption } : qq)));
  }

  async function next() {
    if (!questions || !attemptId) return;
    if (currentIndex === questions.length - 1) {
      const res = await studentFetch(`/diagnostic/attempts/${attemptId}/complete`, { method: 'POST' });
      setSummary(await res.json());
      setState('completed');
      return;
    }
    setCurrentIndex(currentIndex + 1);
  }

  function skip() {
    window.location.href = '/';
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.diagnostic.title}</h1>
      </div>

      {state === 'loading' && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state === 'intro' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>{t.diagnostic.introTitle}</p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20, lineHeight: 1.6 }}>{t.diagnostic.introBody}</p>
          <button onClick={start} disabled={starting} style={{ width: '100%', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, marginBottom: 10 }}>
            {starting ? '…' : t.diagnostic.startButton}
          </button>
          <button onClick={skip} style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'none', color: COLORS.inkMuted, fontSize: 13 }}>
            {t.diagnostic.skipButton}
          </button>
        </div>
      )}

      {state === 'in_progress' && questions && questions[currentIndex] && (
        <div>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 12 }}>
            {currentIndex + 1} / {questions.length}
          </p>
          <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5, marginBottom: 16 }}>{questions[currentIndex].questionText}</p>

          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const q = questions[currentIndex];
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const isCorrectOption = q.answered && q.correctOption === letter;
            const isWrongSelected = q.answered && q.selectedOption === letter && q.correctOption !== letter;
            return (
              <div
                key={letter}
                onClick={() => selectOption(letter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  border: `1.5px solid ${isCorrectOption ? '#16a34a' : isWrongSelected ? '#B4544A' : COLORS.line}`,
                  borderRadius: 10,
                  marginBottom: 8,
                  fontSize: 14,
                  cursor: q.answered ? 'default' : 'pointer',
                  background: isCorrectOption ? '#f0fdf4' : isWrongSelected ? '#fef2f2' : COLORS.paper,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.inkMuted }}>{letter}.</span>
                <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
              </div>
            );
          })}

          {questions[currentIndex].answered && (
            <button onClick={next} style={{ width: '100%', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600, marginTop: 8 }}>
              {currentIndex === questions.length - 1 ? t.diagnostic.finish : t.diagnostic.next}
            </button>
          )}
        </div>
      )}

      {state === 'completed' && (
        <div>
          {summary ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <p style={{ fontFamily: FONT_FAMILY, fontSize: 36, fontWeight: 800, color: COLORS.gold, margin: '10px 0 4px' }}>
                  {summary.totalCorrect} / {summary.totalQuestions}
                </p>
                <p style={{ fontSize: 13, color: COLORS.inkMuted }}>{t.diagnostic.resultSubtitle}</p>
              </div>
              {summary.bySubject.map((s) => (
                <div key={s.subject} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${COLORS.line}`, fontSize: 13 }}>
                  <span>{s.subject}</span>
                  <span style={{ fontWeight: 600 }}>
                    {s.correct}/{s.total}
                  </span>
                </div>
              ))}
              <p style={{ fontSize: 11, color: COLORS.inkMuted, marginTop: 12, lineHeight: 1.5 }}>{t.diagnostic.disclaimer}</p>
            </>
          ) : (
            <p style={{ fontSize: 13, color: COLORS.inkMuted, textAlign: 'center' }}>{t.diagnostic.alreadyDone}</p>
          )}
          <a href="/quiz" style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, marginTop: 16 }}>
            {t.diagnostic.startPractice}
          </a>
        </div>
      )}
    </main>
  );
}
