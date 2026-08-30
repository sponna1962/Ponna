'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '../../../lib/language-context';
import { studentFetch } from '../../../lib/student-fetch';

// Quiz-taking screen — implements §4.3 (Taking a Quiz): one question per
// screen, resumable, ends in a results summary.
//
// No language toggle here (finalized requirement — the earlier real-time
// toggle was dropped). Practice language is a one-time Setup choice (see
// /quiz/page.tsx's Practice Preference Setup) and stays fixed for the whole
// session — every question in this session was allocated in that single
// language, so `content` below only ever has one key populated.

type LangContent = { questionText: string; optionA: string; optionB: string; optionC: string; optionD: string };

type SessionQuestion = {
  sequenceNumber: number;
  questionId: string;
  answered: boolean;
  selectedOption: string | null;
  isCorrect: boolean | null;
  correctOption: string | null; // present once answered=true
  difficulty: 'MEDIUM' | 'HARD';
  category: 'STANDARD' | 'CURRENT_AFFAIRS';
  content: Partial<Record<'TA' | 'EN', LangContent>>; // whichever language(s) exist for this question
};

type SessionData = {
  id: string;
  mode: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  totalQuestions: number;
  questions: SessionQuestion[];
};

type Results = {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  accuracyPercent: number;
};

export default function QuizSessionPage() {
  const { t } = useLanguage();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<SessionData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null); // option LETTER — language-independent
  const [correctOption, setCorrectOption] = useState<string | null>(null); // option LETTER
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadSession() {
    const res = await studentFetch(`/quiz/${sessionId}`);
    if (!res.ok) return;
    const data: SessionData = await res.json();
    setSession(data);

    if (data.status === 'COMPLETED') {
      loadResults();
      return;
    }

    const firstUnanswered = data.questions.findIndex((q) => !q.answered);
    const idx = firstUnanswered === -1 ? data.questions.length - 1 : firstUnanswered;
    setCurrentIndex(idx);

    const q = data.questions[idx];
    if (q?.answered) {
      setSelected(q.selectedOption);
      setCorrectOption(q.correctOption);
    }
  }

  async function loadResults() {
    const res = await studentFetch(`/quiz/${sessionId}/results`);
    if (res.ok) setResults(await res.json());
  }

  // Selecting an option IS submitting — locks immediately, shows feedback at once.
  async function selectOption(letter: string) {
    if (!session || selected || submitting) return;
    setSelected(letter);
    setSubmitting(true);

    const question = session.questions[currentIndex];
    const res = await studentFetch(`/quiz/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: question.questionId, selectedOption: letter }),
    });
    const { correctOption: correct } = await res.json();
    setCorrectOption(correct);
    setSubmitting(false);
  }

  async function goNext() {
    if (!session) return;
    const isLast = currentIndex === session.questions.length - 1;

    if (isLast) {
      await studentFetch(`/quiz/${sessionId}/complete`, { method: 'POST' });
      await loadResults();
      setSession({ ...session, status: 'COMPLETED' });
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    const nextQ = session.questions[nextIndex];
    setSelected(nextQ.answered ? nextQ.selectedOption : null);
    setCorrectOption(nextQ.answered ? nextQ.correctOption : null);
  }

  if (!session) {
    return <main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t.quiz.loading}</main>;
  }

  if (session.status === 'COMPLETED' && results) {
    return <ResultsView results={results} />;
  }

  const q = session.questions[currentIndex];

  // Defensive guard — a session can end up with zero questions if the
  // student's saved preference (Authority/Category/Language combination)
  // has no matching Published questions with a Difficulty set. Without
  // this check, `q` is undefined here and every access below crashes the
  // whole page instead of showing a clear message.
  if (!q) {
    return (
      <main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
        <p>{t.practiceSetup.noQuestionsForSelection}</p>
      </main>
    );
  }

  const isLastQuestion = currentIndex === session.questions.length - 1;
  const answered = !!selected;

  // Real-time language switch: pick whichever language's content is
  // available for THIS question, preferring the student's current toggle
  // state; fall back to whichever language actually exists if the preferred
  // one hasn't been translated yet (e.g. background translation still running).
  // Practice language is fixed for the whole session — content only has one
  // key populated (whichever language the student's saved preference specifies).
  const display = q.content.TA ?? q.content.EN!;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px 0 20px' }}>
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
          {t.quiz.questionCounter(currentIndex + 1, session.totalQuestions)}
        </span>
      </div>

      <div style={{ padding: '12px 20px 0 20px' }}>
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${((currentIndex + 1) / session.totalQuestions) * 100}%`,
              background: '#0f172a',
              borderRadius: 3,
            }}
          />
        </div>
      </div>

      <div style={{ padding: '16px 20px 0 20px', display: 'flex', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#e2e8f0', padding: '4px 10px', borderRadius: 12 }}>
          {t.quiz.difficultyLabel[q.difficulty]}
        </span>
        {q.category === 'CURRENT_AFFAIRS' && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '4px 10px', borderRadius: 12 }}>
            {t.quiz.categoryLabel.CURRENT_AFFAIRS}
          </span>
        )}
      </div>

      <div style={{ padding: '16px 20px 8px 20px' }}>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', lineHeight: 1.5, margin: 0 }}>{display.questionText}</p>
      </div>

      <div style={{ padding: '16px 20px', flex: 1 }}>
        {(['A', 'B', 'C', 'D'] as const).map((letter) => {
          const text = { A: display.optionA, B: display.optionB, C: display.optionC, D: display.optionD }[letter];
          const isSelected = selected === letter;
          const isCorrectOption = answered && correctOption === letter;
          const isWrongSelected = answered && isSelected && correctOption !== letter;

          const borderColor = isCorrectOption ? '#16a34a' : isWrongSelected ? '#dc2626' : isSelected ? '#0f172a' : '#e2e8f0';
          const bgColor = isCorrectOption ? '#f0fdf4' : isWrongSelected ? '#fef2f2' : isSelected ? '#f8fafc' : '#fff';

          return (
            <div
              key={letter}
              onClick={() => selectOption(letter)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                border: `1.5px solid ${borderColor}`,
                borderRadius: 10,
                marginBottom: 10,
                fontSize: 15,
                color: '#1e293b',
                cursor: answered ? 'default' : 'pointer',
                background: bgColor,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: isCorrectOption ? '#16a34a' : isWrongSelected ? '#dc2626' : isSelected ? '#0f172a' : '#f1f5f9',
                  color: isCorrectOption || isWrongSelected || isSelected ? '#fff' : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {isCorrectOption ? '✓' : isWrongSelected ? '✕' : letter}
              </span>
              <span style={{ flex: 1 }}>{text}</span>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '8px 20px 24px 20px' }}>
        {answered && (
          <button
            onClick={goNext}
            style={{ width: '100%', padding: 14, borderRadius: 10, background: '#0f172a', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600 }}
          >
            {isLastQuestion ? t.quiz.finish : t.quiz.next}
          </button>
        )}
      </div>
    </main>
  );
}

function ResultsView({ results }: { results: Results }) {
  const { t } = useLanguage();

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 24 }}>{t.quiz.resultsTitle}</h1>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#0f172a' }}>{results.accuracyPercent.toFixed(0)}%</div>
        <div style={{ fontSize: 13, color: '#64748b' }}>{t.quiz.accuracy}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{results.answeredCount}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t.quiz.answered}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#16a34a' }}>{results.correctCount}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{t.quiz.correct}</div>
        </div>
      </div>

      <a
        href="/dashboard"
        style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: '#0f172a', color: '#fff', textDecoration: 'none', marginBottom: 10, fontWeight: 600 }}
      >
        {t.quiz.backToDashboard}
      </a>
      <a
        href="/quiz"
        style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', color: '#0f172a', textDecoration: 'none', fontWeight: 600 }}
      >
        {t.quiz.practiceAgain}
      </a>
    </main>
  );
}
