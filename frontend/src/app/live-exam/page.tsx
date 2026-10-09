'use client';

// Live Exam — Full-Length Mock Exam Simulation. A genuine timed exam:
// fixed question count + strict time limit matching the configured pattern,
// countdown timer with auto-submit, NO immediate feedback while answering,
// negative marking if configured, syllabus-based paper, one attempt per exam
// per week. The student sees only the remaining-time countdown, not a clock.

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Config = { questionCount: number; durationMinutes: number; marksPerQuestion: number; negativeMarkingFraction: number };
type State =
  | { access: 'FREE_LOCKED' }
  | { access: 'NOT_CONFIGURED' }
  | { access: 'WINDOW_CLOSED'; nextOpensAt: string }
  | { access: 'READY'; config: Config }
  | { access: 'IN_PROGRESS'; attemptId: string; expiresAt: string; config: Config }
  | { access: 'AWAITING_RESULTS'; attemptId: string; resultsReleaseAt: string }
  | { access: 'COMPLETED'; attemptId: string; score: number; totalMarks: number; wasExpired: boolean };

type ExamQuestion = {
  id: string;
  sequenceNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string | null;
  correctOption: string | null;
  explanation: string | null;
};

export default function LiveExamPage() {
  const { t } = useLanguage();
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExamName, setSelectedExamName] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const questionShownAt = useRef<number>(Date.now());

  useEffect(() => {
    questionShownAt.current = Date.now();
  }, [currentIndex]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [starting, setStarting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Every exam that actually has Live Exam configured is shown directly.
  const [availableExams, setAvailableExams] = useState<{ subCategoryId: string; name: string; authorityName: string; categoryName: string }[] | null>(null);
  useEffect(() => {
    studentFetch('/live-exam/available-exams')
      .then((r) => r.json())
      .then(setAvailableExams)
      .catch(() => setAvailableExams([]));
  }, []);

  function handleSelect(subCategoryId: string, subCategoryName: string) {
    setSelectedExamId(subCategoryId);
    setSelectedExamName(subCategoryName);
  }

  function loadState(examId: string) {
    studentFetch(`/live-exam/${examId}/state`)
      .then((r) => r.json())
      .then((s: State) => {
        setState(s);
        if (s.access === 'IN_PROGRESS') loadQuestions(s.attemptId, s.expiresAt);
      });
  }

  useEffect(() => {
    if (!selectedExamId) return;
    setState(null);
    setQuestions(null);
    loadState(selectedExamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId]);

  function loadQuestions(attemptId: string, expiresAt: string) {
    studentFetch(`/live-exam/attempts/${attemptId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data.questions);
        const firstUnanswered = data.questions.findIndex((q: ExamQuestion) => !q.selectedOption);
        setCurrentIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
        startTimer(expiresAt, attemptId);
      });
  }

  function startTimer(expiresAt: string, attemptId: string) {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs <= 0) {
        clearInterval(timerRef.current!);
        submitExam(attemptId, true);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function start() {
    setStarting(true);
    const res = await studentFetch(`/live-exam/${selectedExamId}/start`, { method: 'POST' });
    setStarting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? t.liveExamPage.startError);
      return;
    }
    loadState(selectedExamId);
  }

  async function selectOption(questionId: string, option: string) {
    if (!questions) return;
    setQuestions(questions.map((q) => (q.id === questionId ? { ...q, selectedOption: option } : q)));
    await studentFetch(`/live-exam/attempts/${(state as any).attemptId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedOption: option, timeSpentSeconds: Math.round((Date.now() - questionShownAt.current) / 1000) }),
    });
    // Deliberately no correctness feedback here — a real exam gives none.
  }

  async function submitExam(attemptId: string, auto = false) {
    if (!auto && !confirm(t.liveExamPage.confirmSubmit)) return;
    await studentFetch(`/live-exam/attempts/${attemptId}/submit`, { method: 'POST' });
    loadState(selectedExamId);
  }

  function formatTime(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, paddingBottom: state?.access === 'IN_PROGRESS' ? 100 : 30, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.menu.liveExam}</h1>
        {state?.access === 'IN_PROGRESS' && (
          <div
            aria-label={`மீதமுள்ள நேரம் ${formatTime(remainingSeconds)}`}
            aria-live="polite"
            style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,233,168,0.5)', borderRadius: 6, padding: '5px 12px' }}
          >
            <span style={{ fontFamily: FONT_FAMILY, fontSize: 9.5, fontWeight: 600, color: '#FFE9A8' }}>மீதமுள்ள நேரம்</span>
            <span style={{ fontFamily: FONT_FAMILY, fontSize: 17, fontWeight: 800, color: remainingSeconds < 300 ? '#ffb4a8' : '#fff' }}>
              {formatTime(remainingSeconds)}
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px' }}>
      {state?.access !== 'IN_PROGRESS' && (
        <div style={{ marginBottom: 20 }}>
          {availableExams === null && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}
          {availableExams?.length === 0 && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>No exams have Live Exam set up yet.</p>}
          {availableExams && availableExams.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {availableExams.map((e) => (
                <button
                  key={e.subCategoryId}
                  onClick={() => handleSelect(e.subCategoryId, e.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    padding: '13px 16px',
                    borderRadius: 10,
                    border: selectedExamId === e.subCategoryId ? '1.5px solid #E2B04A' : `1px solid ${COLORS.line}`,
                    background: 'var(--color-card)',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-goldDisc)', display: 'grid', placeItems: 'center', flex: 'none' }}>🎯</span>
                  <span style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 15.5, color: COLORS.ink, margin: 0 }}>{e.name}</p>
                    <p style={{ fontSize: 12.5, color: COLORS.inkMuted, margin: '2px 0 0' }}>
                      {e.authorityName} → {e.categoryName}
                    </p>
                  </span>
                  {selectedExamId === e.subCategoryId && <span aria-hidden="true" style={{ color: 'var(--color-ok)', fontWeight: 800, fontSize: 20 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedExamId && <p style={{ color: COLORS.inkMuted, fontSize: 13, textAlign: 'center' }}>{t.liveExamPage.chooseExamFirst}</p>}
      {selectedExamId && !state && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state?.access === 'FREE_LOCKED' && (
        <div style={{ border: '1.5px solid #E2B04A', borderRadius: 10, padding: 22, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.liveExamPage.lockedTitle}</p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginBottom: 16 }}>{t.liveExamPage.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 14.5 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {state?.access === 'NOT_CONFIGURED' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 28, textAlign: 'center', background: 'var(--color-card)' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.liveExamPage.notConfigured}</p>
        </div>
      )}

      {state?.access === 'WINDOW_CLOSED' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 28, textAlign: 'center', background: 'var(--color-card)' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🗓️ Live Exam தற்போது கிடைக்கவில்லை</p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted }}>
            அடுத்த வாய்ப்பு: {new Date(state.nextOpensAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      )}

      {state?.access === 'AWAITING_RESULTS' && (
        <div style={{ border: '1.5px solid #E2B04A', borderRadius: 10, padding: 28, textAlign: 'center', background: COLORS.goldLight }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>✅ Submit ஆகிடுச்சு!</p>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.7 }}>
            இந்த வார Live Exam-ல் பங்கேற்ற அனைவருக்கும் ஒரே நேரத்தில், <strong>திங்கள் அன்று</strong> result வெளியாகும்.
          </p>
        </div>
      )}

      {state?.access === 'READY' && (
        <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 10, padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: COLORS.ink, margin: '0 0 14px' }}>{t.liveExamPage.readyTitle}</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { n: String(state.config.questionCount), l: t.liveExamPage.questions },
              { n: String(state.config.durationMinutes), l: t.liveExamPage.minutes },
              ...(state.config.negativeMarkingFraction > 0 ? [{ n: `-${state.config.negativeMarkingFraction}`, l: t.liveExamPage.negMark }] : []),
            ].map((x) => (
              <div key={x.l} style={{ flex: 1, background: 'var(--color-field)', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '10px 4px' }}>
                <b style={{ display: 'block', fontSize: 20, color: COLORS.ink }}>{x.n}</b>
                <small style={{ fontSize: 12, color: COLORS.inkMuted }}>{x.l}</small>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-bad)', background: 'var(--color-badBg)', borderRadius: 12, padding: '10px 12px', margin: '0 0 16px', lineHeight: 1.6 }}>{t.liveExamPage.oneAttemptWarning}</p>
          <button onClick={start} disabled={starting} style={{ display: 'block', width: '100%', padding: 16, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', border: 'none', fontWeight: 700, fontSize: 17, boxShadow: '0 10px 24px -10px rgba(15,47,51,0.7)' }}>
            {starting ? '…' : t.liveExamPage.startExam}
          </button>
        </div>
      )}

      {state?.access === 'IN_PROGRESS' && questions && questions[currentIndex] && (
        <div>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, fontWeight: 700, marginBottom: 10 }}>
            {currentIndex + 1} / {questions.length}
          </p>
          <div style={{ height: 8, background: 'var(--color-line)', borderRadius: 4, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${((currentIndex + 1) / questions.length) * 100}%`, background: '#FFD22A', borderRadius: 4 }} />
          </div>
          <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderTop: '4px solid #E2B04A', borderRadius: 10, padding: 18, marginBottom: 14 }}>
            <p style={{ fontSize: questions[currentIndex].questionText.length > 140 ? 16.5 : 18, fontWeight: 600, color: COLORS.ink, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{questions[currentIndex].questionText}</p>
          </div>

          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const q = questions[currentIndex];
            const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
            const isSelected = q.selectedOption === letter;
            return (
              <div
                key={letter}
                onClick={() => selectOption(q.id, letter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  border: `1.5px solid ${isSelected ? 'var(--color-ink)' : COLORS.line}`,
                  borderRadius: 8,
                  marginBottom: 10,
                  fontSize: 15.5,
                  lineHeight: 1.55,
                  cursor: 'pointer',
                  background: 'var(--color-card)',
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5, background: isSelected ? 'var(--color-ink)' : 'var(--color-field)', border: `1.5px solid ${isSelected ? 'var(--color-ink)' : COLORS.line}`, color: isSelected ? 'var(--color-paper)' : COLORS.inkMuted }}>{letter}</span>
                <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
              </div>
            );
          })}

          <button
            onClick={() => setNavigatorOpen((v) => !v)}
            style={{ marginTop: 8, width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: `1px solid ${COLORS.line}`, background: 'var(--color-card)', fontSize: 14, fontWeight: 700, color: COLORS.ink, cursor: 'pointer' }}
          >
            {navigatorOpen ? '▾' : '▸'} Question Navigator ({questions.filter((q) => q.selectedOption).length}/{questions.length} answered)
          </button>

          {navigatorOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentIndex(i);
                    setNavigatorOpen(false);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: `2px solid ${i === currentIndex ? 'var(--color-ink)' : q.selectedOption ? 'var(--color-ok)' : COLORS.line}`,
                    background: q.selectedOption ? 'var(--color-okBg)' : 'var(--color-card)',
                    color: q.selectedOption ? 'var(--color-ok)' : COLORS.ink,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 16px 16px', background: 'linear-gradient(transparent, var(--color-paper) 35%)', zIndex: 5 }}>
            <div style={{ display: 'flex', gap: 10, maxWidth: 448, margin: '0 auto' }}>
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                style={{ flex: 1, padding: 15, borderRadius: 8, border: `1.5px solid ${COLORS.line}`, background: 'var(--color-card)', color: COLORS.ink, fontWeight: 700, fontSize: 16, opacity: currentIndex === 0 ? 0.5 : 1 }}
              >
                {t.liveExamPage.previous}
              </button>
              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  style={{ flex: 1, padding: 15, borderRadius: 8, border: 'none', background: 'var(--color-btn)', color: 'var(--color-btnText)', fontWeight: 700, fontSize: 16 }}
                >
                  {t.liveExamPage.next}
                </button>
              ) : (
                <button
                  onClick={() => submitExam((state as any).attemptId)}
                  style={{ flex: 1, padding: 15, borderRadius: 8, border: 'none', background: '#B4544A', color: '#fff', fontWeight: 700, fontSize: 16 }}
                >
                  {t.liveExamPage.submitExam}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {state?.access === 'COMPLETED' && (
        <div style={{ textAlign: 'center' }}>
          {state.wasExpired && <p style={{ fontSize: 13, color: 'var(--color-bad)', marginBottom: 8 }}>{t.liveExamPage.timeUpNotice}</p>}
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 50, fontWeight: 800, color: COLORS.gold, margin: '20px 0 4px' }}>
            {state.score} / {state.totalMarks}
          </p>
          <p style={{ fontSize: 14.5, color: COLORS.inkMuted, marginBottom: 24 }}>{t.liveExamPage.examComplete}</p>
          <a href="/" style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 8, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 16.5 }}>
            {t.dailyQuiz.backHome}
          </a>
        </div>
      )}
      </div>
    </main>
  );
}
