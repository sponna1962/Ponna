'use client';

// Daily Quiz — student-facing flow (finalized requirement). Completely
// separate from normal Practice: its own state machine, its own backend
// calls, never touches quota.service.ts/allocation.service.ts or
// UserQuestionHistory/UserPerformanceSummary.
//
// Flow: check "enabled" (Coming Soon gate) -> check student state
// (Free-locked / not-available-yet / needs-language / resume / results)
// -> language selection -> one question at a time with immediate
// result+explanation -> final results screen. Resuming picks up at the
// next unanswered question; an already-answered question is never
// re-presented for answering (finalized requirement).

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { apiUrl } from '../../lib/api-config';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type StudentState =
  | { access: 'FREE_LOCKED' }
  | { access: 'NOT_AVAILABLE' }
  | {
      access: 'AVAILABLE';
      quizId: string;
      expiresAt: string;
      totalQuestions: number;
      attempt: { language: 'TA' | 'EN'; completedAt: string | null; score: number | null; answeredQuestionIds: string[] } | null;
    };

type AttemptQuestion = {
  id: string;
  sequenceNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answered: boolean;
  selectedOption: string | null;
  isCorrect: boolean | null;
  correctOption: string | null;
  explanation: string | null;
};

type AttemptQuestions = { attemptId: string; language: 'TA' | 'EN'; completedAt: string | null; score: number | null; questions: AttemptQuestion[] };

export default function DailyQuizPage() {
  const { t } = useLanguage();
  const [checkedEnabled, setCheckedEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<StudentState | null>(null);
  const [attemptData, setAttemptData] = useState<AttemptQuestions | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl('/daily-quiz/enabled'))
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false))
      .finally(() => setCheckedEnabled(true));
  }, []);

  useEffect(() => {
    if (!checkedEnabled || !enabled) return;
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedEnabled, enabled]);

  async function loadState() {
    const res = await studentFetch('/daily-quiz/state');
    const data: StudentState = await res.json();
    setState(data);
    if (data.access === 'AVAILABLE' && data.attempt) {
      await loadAttemptQuestions(data.quizId, data.attempt.language);
    }
  }

  async function loadAttemptQuestions(quizId: string, language: 'TA' | 'EN') {
    // The attemptId isn't in `state` directly — start/resume returns it,
    // but on a fresh page load we don't have it yet, so resolve it by
    // starting (which is idempotent — resuming an existing attempt never
    // creates a new one or changes its language).
    const startRes = await studentFetch(`/daily-quiz/${quizId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
    const attempt = await startRes.json();
    const qRes = await studentFetch(`/daily-quiz/attempts/${attempt.id}/questions`);
    const qData: AttemptQuestions = await qRes.json();
    setAttemptData(qData);
    const firstUnanswered = qData.questions.findIndex((q) => !q.answered);
    setCurrentIndex(firstUnanswered === -1 ? qData.questions.length - 1 : firstUnanswered);
  }

  async function startWithLanguage(language: 'TA' | 'EN') {
    if (state?.access !== 'AVAILABLE') return;
    setStarting(true);
    setError(null);
    try {
      const res = await studentFetch(`/daily-quiz/${state.quizId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Could not start Daily Quiz.');
        return;
      }
      const attempt = await res.json();
      const qRes = await studentFetch(`/daily-quiz/attempts/${attempt.id}/questions`);
      setAttemptData(await qRes.json());
      setCurrentIndex(0);
    } finally {
      setStarting(false);
    }
  }

  async function selectOption(letter: string) {
    if (!attemptData) return;
    const q = attemptData.questions[currentIndex];
    if (q.answered || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await studentFetch(`/daily-quiz/attempts/${attemptData.attemptId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q.id, selectedOption: letter }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Could not submit answer.');
      return;
    }
    const answer = await res.json();
    setAttemptData({
      ...attemptData,
      questions: attemptData.questions.map((qq, i) =>
        i === currentIndex
          ? { ...qq, answered: true, selectedOption: answer.selectedOption, isCorrect: answer.isCorrect, correctOption: qq.correctOption ?? null }
          : qq,
      ),
    });
    // Re-fetch to get the revealed correctOption/explanation (server only
    // reveals these once answered).
    const qRes = await studentFetch(`/daily-quiz/attempts/${attemptData.attemptId}/questions`);
    setAttemptData(await qRes.json());
  }

  async function goNext() {
    if (!attemptData) return;
    const isLast = currentIndex === attemptData.questions.length - 1;
    if (isLast) {
      await studentFetch(`/daily-quiz/attempts/${attemptData.attemptId}/complete`, { method: 'POST' });
      const qRes = await studentFetch(`/daily-quiz/attempts/${attemptData.attemptId}/questions`);
      setAttemptData(await qRes.json());
      return;
    }
    setCurrentIndex(currentIndex + 1);
  }

  if (!checkedEnabled) return null;

  if (!enabled) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
        <BitterFontLinks />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <StudentMenu />
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.menu.dailyQuiz}</h1>
        </div>
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.comingSoon}</p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.menu.dailyQuiz}</h1>
      </div>

      {!state && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state?.access === 'FREE_LOCKED' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 14, padding: 24, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.dailyQuiz.lockedTitle}</p>
          <p style={{ fontSize: 13, color: '#5C4009', marginBottom: 16 }}>{t.dailyQuiz.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {state?.access === 'NOT_AVAILABLE' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.dailyQuiz.notAvailable}</p>
        </div>
      )}

      {state?.access === 'AVAILABLE' && !state.attempt && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 4 }}>{t.dailyQuiz.readyTitle}</p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20 }}>{t.dailyQuiz.chooseLanguage}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => startWithLanguage('TA')}
              disabled={starting}
              style={{ padding: '12px 24px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600 }}
            >
              தமிழ்
            </button>
            <button
              onClick={() => startWithLanguage('EN')}
              disabled={starting}
              style={{ padding: '12px 24px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600 }}
            >
              English
            </button>
          </div>
          {error && <p style={{ color: '#B4544A', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {attemptData && !attemptData.completedAt && attemptData.questions[currentIndex] && (
        <QuestionView
          question={attemptData.questions[currentIndex]}
          index={currentIndex}
          total={attemptData.questions.length}
          onSelect={selectOption}
          onNext={goNext}
          submitting={submitting}
        />
      )}

      {attemptData?.completedAt && <ResultsView data={attemptData} />}
    </main>
  );
}

function QuestionView({
  question,
  index,
  total,
  onSelect,
  onNext,
  submitting,
}: {
  question: AttemptQuestion;
  index: number;
  total: number;
  onSelect: (letter: string) => void;
  onNext: () => void;
  submitting: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 12 }}>
        {index + 1} / {total}
      </p>
      <p style={{ fontSize: 17, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5, marginBottom: 16 }}>{question.questionText}</p>

      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
        const text = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD }[letter];
        const isCorrectOption = question.answered && question.correctOption === letter;
        const isWrongSelected = question.answered && question.selectedOption === letter && question.correctOption !== letter;
        const borderColor = isCorrectOption ? '#16a34a' : isWrongSelected ? '#B4544A' : COLORS.line;
        return (
          <div
            key={letter}
            onClick={() => onSelect(letter)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              border: `1.5px solid ${borderColor}`,
              borderRadius: 10,
              marginBottom: 8,
              fontSize: 14,
              cursor: question.answered ? 'default' : 'pointer',
              background: isCorrectOption ? '#f0fdf4' : isWrongSelected ? '#fef2f2' : COLORS.paper,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.inkMuted }}>{letter}.</span>
            <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
            {isCorrectOption && <span style={{ color: '#16a34a' }}>✓</span>}
            {isWrongSelected && <span style={{ color: '#B4544A' }}>✕</span>}
          </div>
        );
      })}

      {question.answered && question.explanation && (
        <div style={{ background: COLORS.paperAlt, borderRadius: 8, padding: 12, marginTop: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: COLORS.inkMuted, lineHeight: 1.5, margin: 0 }}>{question.explanation}</p>
        </div>
      )}

      {question.answered && (
        <button onClick={onNext} disabled={submitting} style={{ width: '100%', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600 }}>
          {index === total - 1 ? t.quiz.finish : t.quiz.next}
        </button>
      )}
    </div>
  );
}

function ResultsView({ data }: { data: AttemptQuestions }) {
  const { t } = useLanguage();
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_FAMILY, fontSize: 42, fontWeight: 800, color: COLORS.gold, margin: '20px 0 4px' }}>
        {data.score}/{data.questions.length}
      </p>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 24 }}>{t.dailyQuiz.resultsSubtitle}</p>
      <a href="/" style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600 }}>
        {t.dailyQuiz.backHome}
      </a>
    </div>
  );
}
