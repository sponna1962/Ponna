'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLanguage } from '../../../lib/language-context';
import { studentFetch } from '../../../lib/student-fetch';
import { useOnlineStatus } from '../../../lib/use-online-status';

type LangContent = { questionText: string; optionA: string; optionB: string; optionC: string; optionD: string };

type SessionQuestion = {
  sequenceNumber: number;
  questionId: string;
  answered: boolean;
  selectedOption: string | null;
  isCorrect: boolean | null;
  correctOption: string | null;
  explanation: string | null;
  difficulty: 'MEDIUM' | 'HARD';
  category: 'STANDARD' | 'CURRENT_AFFAIRS';
  content: Partial<Record<'TA' | 'EN', LangContent>>;
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
  const questionShownAt = useRef<number>(Date.now());

  useEffect(() => {
    questionShownAt.current = Date.now();
  }, [currentIndex]);

  const [selected, setSelected] = useState<string | null>(null);
  const [correctOption, setCorrectOption] = useState<string | null>(null);
  // Sept 2026 (Tap-to-Reveal Explanation) — collapsed by default, never
  // auto-shown, so it never interrupts practice flow for students who
  // don't need it. No "AI" labeling anywhere near this per explicit
  // design decision — plain "காரணம் பார்க்க" wording only.
  const [explanation, setExplanation] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Results | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<'WRONG_ANSWER' | 'UNCLEAR_OR_TYPO' | 'WRONG_OPTIONS' | 'OTHER'>('WRONG_ANSWER');
  const [reportComment, setReportComment] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function loadSession() {
    // Sept 2026 (real bug fix, confirmed from a live crash report) — was
    // unguarded: if the fetch itself failed (network drop) or the
    // response body wasn't valid JSON for any reason, this threw inside
    // a useEffect-fired async call with nothing to catch it -- an
    // uncaught rejection that can surface as a full page crash, right
    // after navigating here from Start Practising.
    try {
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
        setExplanation(q.explanation);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadResults() {
    const res = await studentFetch(`/quiz/${sessionId}/results`);
    if (res.ok) setResults(await res.json());
  }

  async function selectOption(letter: string) {
    if (!session || selected || submitting) return;
    if (!isOnline) return;
    setSelected(letter);
    setSubmitting(true);
    setShowExplanation(false);

    const question = session.questions[currentIndex];
    const res = await studentFetch(`/quiz/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: question.questionId,
        selectedOption: letter,
        timeSpentSeconds: Math.round((Date.now() - questionShownAt.current) / 1000),
      }),
    });
    const { correctOption: correct, explanation: exp } = await res.json();
    setCorrectOption(correct);
    setExplanation(exp ?? null);
    setSubmitting(false);
  }

  async function goNext() {
    if (!session) return;
    const isLast = currentIndex === session.questions.length - 1;

    if (isLast) {
      if (!isOnline) return;
      await studentFetch(`/quiz/${sessionId}/complete`, { method: 'POST' });

      // Free practice: after the student presses the normal Next button on
      // question 5, show a dedicated completion page explaining that today's
      // five free questions are over and offering the Annual Plan. Paid users
      // continue to the normal results screen.
      const accessRes = await studentFetch('/quiz/access-status');
      if (accessRes.ok) {
        const access = await accessRes.json();
        if (access.hasPreference && !access.covered) {
          const target = access.applicablePlanId
            ? `/quiz/free-complete?planId=${encodeURIComponent(access.applicablePlanId)}`
            : '/quiz/free-complete';
          window.location.href = target;
          return;
        }
      }

      await loadResults();
      setSession({ ...session, status: 'COMPLETED' });
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    const nextQ = session.questions[nextIndex];
    setSelected(nextQ.answered ? nextQ.selectedOption : null);
    setCorrectOption(nextQ.answered ? nextQ.correctOption : null);
    setExplanation(nextQ.answered ? nextQ.explanation : null);
    setShowExplanation(false);
  }

  function openReport() {
    setReportReason('WRONG_ANSWER');
    setReportComment('');
    setReportDone(false);
    setReportOpen(true);
  }

  async function submitReport() {
    if (!session) return;
    setReportSubmitting(true);
    try {
      const q = session.questions[currentIndex];
      await studentFetch(`/questions/${q.questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason, comment: reportComment }),
      });
      setReportDone(true);
    } finally {
      setReportSubmitting(false);
    }
  }

  if (!session) {
    return <main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>{t.quiz.loading}</main>;
  }

  if (session.status === 'COMPLETED' && results) {
    return <ResultsView results={results} />;
  }

  const q = session.questions[currentIndex];
  if (!q) {
    return (
      <main style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
        <p>{t.practiceSetup.noQuestionsForSelection}</p>
      </main>
    );
  }

  const isLastQuestion = currentIndex === session.questions.length - 1;
  const answered = !!selected;
  const display = q.content.TA ?? q.content.EN!;

  const isLongQuestion = display.questionText.length > 140;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--color-paper)', color: 'var(--color-ink)', paddingBottom: 96 }}>
      {/* Oct 2026 redesign — presentation only; answer / report / offline logic unchanged. */}
      {!isOnline && (
        <div style={{ background: 'var(--color-goldDisc)', borderBottom: '1px solid #E2B04A', padding: '8px 20px', fontSize: 12, color: 'var(--color-inkMuted)', textAlign: 'center' }}>
          {t.quiz.offlineNotice}
        </div>
      )}
      <div style={{ padding: '16px 20px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, color: 'var(--color-inkMuted)', fontWeight: 700 }}>
          {t.quiz.questionCounter(currentIndex + 1, session.totalQuestions)}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-gold)', background: 'var(--color-goldDisc)', padding: '5px 12px', borderRadius: 999 }}>
            {t.quiz.difficultyLabel[q.difficulty]}
          </span>
          {q.category === 'CURRENT_AFFAIRS' && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '5px 12px', borderRadius: 999 }}>
              {t.quiz.categoryLabel.CURRENT_AFFAIRS}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '12px 20px 0 20px' }}>
        <div style={{ height: 8, background: 'var(--color-line)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((currentIndex + 1) / session.totalQuestions) * 100}%`, background: 'linear-gradient(90deg,#E2B04A,#D99A1E)', borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ margin: '18px 16px 0', background: 'var(--color-card)', border: '1px solid var(--color-line)', borderTop: '4px solid #E2B04A', borderRadius: 16, padding: '20px 18px', boxShadow: '0 10px 26px -20px rgba(15,47,51,0.6)' }}>
        <p style={{ fontSize: isLongQuestion ? 16.5 : 19, fontWeight: 600, color: 'var(--color-ink)', lineHeight: isLongQuestion ? 1.65 : 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{display.questionText}</p>
        <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
          <button
            onClick={openReport}
            style={{ background: 'none', border: 'none', color: 'var(--color-inkMuted)', fontSize: 12, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t.quiz.reportIssue}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {(['A', 'B', 'C', 'D'] as const).map((letter) => {
          const text = { A: display.optionA, B: display.optionB, C: display.optionC, D: display.optionD }[letter];
          const isSelected = selected === letter;
          const isCorrectOption = answered && correctOption === letter;
          const isWrongSelected = answered && isSelected && correctOption !== letter;
          const borderColor = isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : isSelected ? 'var(--color-ink)' : 'var(--color-line)';
          const bgColor = isCorrectOption ? 'var(--color-okBg)' : isWrongSelected ? 'var(--color-badBg)' : 'var(--color-card)';

          return (
            <div
              key={letter}
              onClick={() => selectOption(letter)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                border: `1.5px solid ${borderColor}`,
                borderRadius: 14,
                marginBottom: 12,
                fontSize: 16.5,
                fontWeight: 500,
                lineHeight: 1.55,
                color: 'var(--color-ink)',
                cursor: answered ? 'default' : !isOnline ? 'not-allowed' : 'pointer',
                background: bgColor,
                opacity: !answered && !isOnline ? 0.5 : 1,
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : isSelected ? 'var(--color-ink)' : 'var(--color-field)',
                  border: `1.5px solid ${isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : isSelected ? 'var(--color-ink)' : 'var(--color-line)'}`,
                  color: isCorrectOption || isWrongSelected ? '#fff' : isSelected ? 'var(--color-paper)' : 'var(--color-inkMuted)',
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

      {/* Sept 2026 (Tap-to-Reveal Explanation) — collapsed by default,
          a small link, never auto-shown or interruptive. No "AI" labeling
          anywhere here per explicit design decision. Absent entirely when
          this question has no explanation yet. */}
      {answered && explanation && (
        <div style={{ padding: '4px 16px 8px 16px' }}>
          {!showExplanation ? (
            <button
              onClick={() => setShowExplanation(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', background: 'var(--color-goldDisc)', border: '1.5px solid #E2B04A', borderRadius: 14, padding: '13px 16px', color: 'var(--color-ink)', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}
            >
              <span aria-hidden="true">💡</span> ஏன் இது சரி?
            </button>
          ) : (
            <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-line)', borderLeft: '4px solid #E2B04A', borderRadius: 12, padding: '12px 14px', fontSize: 14.5, color: 'var(--color-inkMuted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {explanation}
            </div>
          )}
        </div>
      )}

      {/* Sticky "Next" — always reachable, however long the question is. */}
      {answered && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 16px 16px', background: 'linear-gradient(transparent, var(--color-paper) 40%)', zIndex: 5 }}>
          <button
            onClick={goNext}
            disabled={isLastQuestion && !isOnline}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
              padding: 16,
              borderRadius: 14,
              background: isLastQuestion && !isOnline ? '#94a3b8' : 'var(--color-btn)',
              color: isLastQuestion && !isOnline ? '#fff' : 'var(--color-btnText)',
              border: 'none',
              fontSize: 17,
              fontWeight: 700,
              boxShadow: '0 10px 24px -10px rgba(15,47,51,0.7)',
              cursor: isLastQuestion && !isOnline ? 'not-allowed' : 'pointer',
            }}
          >
            {isLastQuestion && !isOnline ? t.quiz.finishOffline : t.quiz.next}
          </button>
        </div>
      )}

      {reportOpen && (
        <div
          onClick={() => setReportOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--color-card)', color: 'var(--color-ink)', borderRadius: '20px 20px 0 0', padding: 20 }}
          >
            {!reportDone ? (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--color-ink)' }}>{t.quiz.reportTitle}</h3>
                <p style={{ fontSize: 12, color: 'var(--color-inkMuted)', marginBottom: 14 }}>{t.quiz.reportNote}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {(['WRONG_ANSWER', 'UNCLEAR_OR_TYPO', 'WRONG_OPTIONS', 'OTHER'] as const).map((r) => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-ink)' }}>
                      <input type="radio" name="reportReason" checked={reportReason === r} onChange={() => setReportReason(r)} />
                      {t.quiz.reportReasons[r]}
                    </label>
                  ))}
                </div>

                <textarea
                  value={reportComment}
                  onChange={(e) => setReportComment(e.target.value)}
                  placeholder={t.quiz.reportCommentPlaceholder}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid var(--color-line)', background: 'var(--color-field)', color: 'var(--color-ink)', marginBottom: 14, boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 13 }}
                  rows={2}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setReportOpen(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1.5px solid var(--color-line)', background: 'var(--color-card)', color: 'var(--color-ink)' }}>
                    {t.login.cancel}
                  </button>
                  <button
                    onClick={submitReport}
                    disabled={reportSubmitting}
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700 }}
                  >
                    {reportSubmitting ? '…' : t.quiz.reportSubmit}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, color: 'var(--color-ink)', marginBottom: 16 }}>✅ {t.quiz.reportThanks}</p>
                <button onClick={() => setReportOpen(false)} style={{ width: '100%', padding: 12, borderRadius: 12, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700 }}>
                  {t.quiz.reportClose}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ResultsView({ results }: { results: Results }) {
  const { t } = useLanguage();
  const pct = Math.max(0, Math.min(100, results.accuracyPercent));

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24, background: 'var(--color-paper)', color: 'var(--color-ink)' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, textAlign: 'center', marginBottom: 22 }}>{t.quiz.resultsTitle}</h1>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div style={{ width: 170, height: 170, borderRadius: '50%', background: `conic-gradient(#E2B04A 0 ${pct}%, var(--color-line) 0)`, display: 'grid', placeItems: 'center' }}>
          <div style={{ width: 138, height: 138, borderRadius: '50%', background: 'var(--color-paper)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 42, fontWeight: 800 }}>{results.accuracyPercent.toFixed(0)}%</div>
            <div style={{ fontSize: 13, color: 'var(--color-inkMuted)' }}>{t.quiz.accuracy}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '26px 0' }}>
        <div style={{ flex: 1, textAlign: 'center', background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{results.answeredCount}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-inkMuted)' }}>{t.quiz.answered}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-ok)' }}>{results.correctCount}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-inkMuted)' }}>{t.quiz.correct}</div>
        </div>
      </div>

      <a
        href="/dashboard"
        style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 14, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', marginBottom: 12, fontWeight: 700, fontSize: 16.5, boxShadow: '0 10px 24px -12px rgba(15,47,51,0.7)' }}
      >
        {t.quiz.backToDashboard}
      </a>
      <a
        href="/quiz"
        style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 14, border: '1.5px solid var(--color-line)', background: 'var(--color-card)', color: 'var(--color-ink)', textDecoration: 'none', fontWeight: 700, fontSize: 16.5 }}
      >
        {t.quiz.practiceAgain}
      </a>
    </main>
  );
}
