'use client';

// Daily Quiz + Brain Challenge — student-facing flow (finalized
// requirement: Brain Challenge shares this exact page/UI/interaction
// pattern as a second mode, with its own separate questions/content).
// Completely separate from normal Practice: its own state machine, its
// own backend calls, never touches quota.service.ts/allocation.service.ts
// or UserQuestionHistory/UserPerformanceSummary.
//
// Flow: pick a mode (tabs) -> check "enabled" (Coming Soon gate) -> check
// student state (Free-locked / not-available-yet / needs-language /
// resume / results) -> language selection -> one question at a time with
// immediate result+explanation -> final results screen. Resuming picks up
// at the next unanswered question; an already-answered question is never
// re-presented for answering (finalized requirement). Every backend call
// below is scoped to the active mode's own DailyQuiz row (quizType) —
// Daily Quiz and Brain Challenge attempts, questions, and completion
// state never mix.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { apiUrl } from '../../lib/api-config';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type QuizType = 'DAILY_QUIZ' | 'BRAIN_CHALLENGE';

type StudentState =
  | { access: 'FREE_LOCKED' }
  | { access: 'NOT_AVAILABLE' }
  | { access: 'COMPLETED'; quizId: string; attemptId: string; totalQuestions: number; score: number; correctCount: number; incorrectCount: number }
  | {
      access: 'AVAILABLE';
      quizId: string;
      expiresAt: string;
      totalQuestions: number;
      attempt: { language: 'TA' | 'EN'; answeredQuestionIds: string[] } | null;
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
  const [quizType, setQuizType] = useState<QuizType>('DAILY_QUIZ');
  const [checkedEnabled, setCheckedEnabled] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<StudentState | null>(null);
  const [attemptData, setAttemptData] = useState<AttemptQuestions | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Re-runs the whole check whenever the mode tab changes — each mode is
  // its own independent DailyQuiz row/attempt, so nothing from the
  // previous mode carries over.
  useEffect(() => {
    setCheckedEnabled(false);
    setState(null);
    setAttemptData(null);
    setShowReview(false);
    setError(null);
    fetch(apiUrl(`/daily-quiz/enabled?type=${quizType}`))
      .then((r) => r.json())
      .then((d) => setEnabled(!!d.enabled))
      .catch(() => setEnabled(false))
      .finally(() => setCheckedEnabled(true));
  }, [quizType]);

  useEffect(() => {
    if (!checkedEnabled || !enabled) return;
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedEnabled, enabled]);

  async function loadState() {
    const res = await studentFetch(`/daily-quiz/state?type=${quizType}`);
    const data: StudentState = await res.json();
    setState(data);
    if (data.access === 'AVAILABLE' && data.attempt) {
      await loadAttemptQuestions(data.quizId, data.attempt.language);
    }
    // COMPLETED — deliberately does NOT auto-fetch the full review (finalized
    // requirement: show the Completed summary first; only fetch the
    // question-by-question review when the student explicitly asks for it).
  }

  async function loadReview(attemptId: string) {
    const qRes = await studentFetch(`/daily-quiz/attempts/${attemptId}/questions`);
    setAttemptData(await qRes.json());
    setShowReview(true);
  }

  async function loadAttemptQuestions(quizId: string, language: 'TA' | 'EN') {
    // The attemptId isn't in `state` directly — start/resume returns it,
    // but on a fresh page load we don't have it yet, so resolve it by
    // starting (which is idempotent — resuming an existing attempt never
    // creates a new one or changes its language). If the quiz expired in
    // the exact gap between loadState()'s check and this call, this can
    // fail — fall back to re-checking state rather than crashing on a
    // response that isn't actually an attempt.
    const startRes = await studentFetch(`/daily-quiz/${quizId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
    if (!startRes.ok) {
      await loadState();
      return;
    }
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
        setError(body.error ?? 'Could not start. Please try again.');
        return;
      }
      const attempt = await res.json();
      const qRes = await studentFetch(`/daily-quiz/attempts/${attempt.id}/questions`);
      setAttemptData(await qRes.json());
      setCurrentIndex(0);
      // Root cause of the language-selector-never-hiding bug: `state`
      // itself was never updated here, so `!state.attempt` (the
      // selector's render condition) stayed true forever after starting.
      setState({ ...state, attempt: { language, answeredQuestionIds: [] } });
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
      // Re-derive from the top — this is what correctly transitions the
      // state machine from AVAILABLE (in-progress) to COMPLETED, since
      // that's now a distinct `access` value from the backend rather than
      // a flag inside the attempt data.
      setAttemptData(null);
      await loadState();
      return;
    }
    setCurrentIndex(currentIndex + 1);
  }

  if (!checkedEnabled) return null;

  const tabs = (
    <div style={{ display: 'flex', gap: 6, background: 'var(--color-field)', border: '1px solid var(--color-line)', borderRadius: 6, padding: 4, marginBottom: 18 }}>
      {(['DAILY_QUIZ', 'BRAIN_CHALLENGE'] as const).map((qt) => (
        <button
          key={qt}
          onClick={() => setQuizType(qt)}
          style={{
            flex: 1,
            padding: '9px 6px',
            borderRadius: 6,
            border: 'none',
            background: quizType === qt ? 'var(--color-btn)' : 'transparent',
            color: quizType === qt ? 'var(--color-btnText)' : COLORS.inkMuted,
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          {qt === 'DAILY_QUIZ' ? t.dailyQuiz.currentAffairs : t.dailyQuiz.brainChallenge}
        </button>
      ))}
    </div>
  );

  if (!enabled) {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
        <BitterFontLinks />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
          <StudentMenu iconColor="#fff" />
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>
            {t.menu.dailyQuiz}
          </h1>
        </div>
        <div style={{ padding: 16 }}>
        {tabs}
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 28, textAlign: 'center', background: 'var(--color-card)' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.comingSoon}</p>
        </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
          <StudentMenu iconColor="#fff" />
          <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>
            {t.menu.dailyQuiz}
          </h1>
        </div>
        <div style={{ padding: 16 }}>
      {tabs}

      {!state && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state?.access === 'FREE_LOCKED' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 10, padding: 22, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>
            🔒 {quizType === 'DAILY_QUIZ' ? t.dailyQuiz.currentAffairs : t.dailyQuiz.brainChallenge} — {t.dailyQuiz.lockedSuffix}
          </p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginBottom: 16 }}>{t.dailyQuiz.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 14.5 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {state?.access === 'NOT_AVAILABLE' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 28, textAlign: 'center', background: 'var(--color-card)' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.dailyQuiz.notAvailable(quizType === 'DAILY_QUIZ' ? t.dailyQuiz.currentAffairs : t.dailyQuiz.brainChallenge)}</p>
        </div>
      )}

      {state?.access === 'AVAILABLE' && !state.attempt && !attemptData && (
        <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 10, padding: '24px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>{t.dailyQuiz.readyTitle(quizType === 'DAILY_QUIZ' ? t.dailyQuiz.currentAffairs : t.dailyQuiz.brainChallenge)}</p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginBottom: 18, lineHeight: 1.6 }}>{t.dailyQuiz.chooseLanguage}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => startWithLanguage('TA')}
              disabled={starting}
              style={{ flex: 1, padding: 15, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', fontWeight: 700, fontSize: 16.5 }}
            >
              தமிழ்
            </button>
            <button
              onClick={() => startWithLanguage('EN')}
              disabled={starting}
              style={{ flex: 1, padding: 15, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', fontWeight: 700, fontSize: 16.5 }}
            >
              English
            </button>
          </div>
          {error && <p style={{ color: '#B4544A', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {attemptData && !showReview && attemptData.questions[currentIndex] && state?.access === 'AVAILABLE' && (
        <QuestionView
          question={attemptData.questions[currentIndex]}
          index={currentIndex}
          total={attemptData.questions.length}
          onSelect={selectOption}
          onNext={goNext}
          submitting={submitting}
        />
      )}

      {state?.access === 'COMPLETED' && !showReview && (
        <CompletedSummary
          totalQuestions={state.totalQuestions}
          correctCount={state.correctCount}
          incorrectCount={state.incorrectCount}
          onReview={() => loadReview(state.attemptId)}
        />
      )}
      {state?.access === 'COMPLETED' && showReview && attemptData && <ReviewAnswers data={attemptData} />}
        </div>
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
  const isLong = question.questionText.length > 140;
  return (
    <div style={{ paddingBottom: 90 }}>
      <p style={{ fontSize: 14, color: COLORS.inkMuted, fontWeight: 700, marginBottom: 10 }}>
        {index + 1} / {total}
      </p>
      <div style={{ height: 8, background: 'var(--color-line)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${((index + 1) / total) * 100}%`, background: '#FFD22A', borderRadius: 4 }} />
      </div>
      <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <p style={{ fontSize: isLong ? 16.5 : 18, fontWeight: 600, color: COLORS.ink, lineHeight: isLong ? 1.65 : 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{question.questionText}</p>
      </div>

      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
        const text = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD }[letter];
        const isCorrectOption = question.answered && question.correctOption === letter;
        const isWrongSelected = question.answered && question.selectedOption === letter && question.correctOption !== letter;
        const borderColor = isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : COLORS.line;
        return (
          <div
            key={letter}
            onClick={() => onSelect(letter)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              border: `1.5px solid ${borderColor}`,
              borderRadius: 8,
              marginBottom: 10,
              fontSize: 15.5,
              lineHeight: 1.55,
              cursor: question.answered ? 'default' : 'pointer',
              background: isCorrectOption ? 'var(--color-okBg)' : isWrongSelected ? 'var(--color-badBg)' : 'var(--color-card)',
            }}
          >
            <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5, background: isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : 'var(--color-field)', border: `1.5px solid ${isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : COLORS.line}`, color: isCorrectOption || isWrongSelected ? '#fff' : COLORS.inkMuted }}>
              {isCorrectOption ? '✓' : isWrongSelected ? '✕' : letter}
            </span>
            <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
          </div>
        );
      })}

      {question.answered && question.explanation && (
        <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderLeft: '4px solid #E2B04A', borderRadius: 12, padding: '11px 13px', marginTop: 6 }}>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{question.explanation}</p>
        </div>
      )}

      {question.answered && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 16px 16px', background: 'linear-gradient(transparent, var(--color-paper) 40%)', zIndex: 5 }}>
          <button onClick={onNext} disabled={submitting} style={{ display: 'block', width: '100%', maxWidth: 448, margin: '0 auto', padding: 16, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', fontWeight: 700, fontSize: 17, boxShadow: '0 10px 24px -10px rgba(15,47,51,0.7)' }}>
            {index === total - 1 ? t.quiz.finish : t.quiz.next}
          </button>
        </div>
      )}
    </div>
  );
}

function CompletedSummary({
  totalQuestions,
  correctCount,
  incorrectCount,
  onReview,
}: {
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  onReview: () => void;
}) {
  const { t } = useLanguage();
  const pct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  return (
    <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 10, padding: '22px 18px', textAlign: 'center' }}>
      <span style={{ display: 'inline-block', background: 'var(--color-okBg)', color: 'var(--color-ok)', fontWeight: 700, fontSize: 13, padding: '5px 14px', borderRadius: 6 }}>{t.dailyQuiz.completedBadge}</span>
      <div style={{ width: 150, height: 150, borderRadius: '50%', margin: '14px auto 18px', background: `conic-gradient(#E2B04A 0 ${pct}%, var(--color-line) 0)`, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'var(--color-card)', display: 'grid', placeItems: 'center', fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 800, color: COLORS.ink }}>
          {correctCount}/{totalQuestions}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 12, background: 'var(--color-field)' }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-ok)', margin: 0 }}>{correctCount}</p>
          <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: 0 }}>{t.quiz.correct}</p>
        </div>
        <div style={{ flex: 1, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 12, background: 'var(--color-field)' }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-bad)', margin: 0 }}>{incorrectCount}</p>
          <p style={{ fontSize: 12, color: COLORS.inkMuted, margin: 0 }}>{t.dailyQuiz.incorrect}</p>
        </div>
      </div>
      {/* No retake — a Daily Quiz attempt is one-time (finalized requirement) */}
      <button onClick={onReview} style={{ width: '100%', padding: 16, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', fontWeight: 700, fontSize: 16.5 }}>
        {t.dailyQuiz.viewReview}
      </button>
    </div>
  );
}

function ReviewAnswers({ data }: { data: AttemptQuestions }) {
  const { t } = useLanguage();
  return (
    <div>
      {data.questions.map((q, i) => (
        <div key={q.id} style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '3px solid #E2B04A', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5, marginBottom: 10 }}>
            {i + 1}. {q.questionText}
          </p>
          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const isCorrectOption = q.correctOption === letter;
            const isWrongSelected = q.selectedOption === letter && q.correctOption !== letter;
            return (
              <div
                key={letter}
                style={{
                  fontSize: 13,
                  padding: '8px 10px',
                  borderRadius: 8,
                  marginBottom: 4,
                  background: isCorrectOption ? COLORS.goldLight : 'transparent',
                  color: isCorrectOption ? COLORS.ink : isWrongSelected ? 'var(--color-bad)' : COLORS.inkMuted,
                  fontWeight: isCorrectOption ? 700 : 400,
                }}
              >
                {letter}. {text} {isCorrectOption && '✓'} {isWrongSelected && '✕'}
              </div>
            );
          })}
          {q.explanation && <p style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 8, lineHeight: 1.5 }}>{q.explanation}</p>}
        </div>
      ))}
      <a href="/" style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 16.5 }}>
        {t.dailyQuiz.backHome}
      </a>
    </div>
  );
}
