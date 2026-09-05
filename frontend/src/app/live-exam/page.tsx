'use client';

// Live Exam — Full-Length Mock Exam Simulation (finalized requirement,
// ₹999 Annual Plan value-add, item 2 of 3). A genuine timed exam: fixed
// question count + strict time limit matching the real exam pattern,
// countdown timer with auto-submit, NO immediate feedback while
// answering (unlike Daily Quiz/normal Practice — a real exam never tells
// you if you're right as you go), negative marking if configured, full
// syllabus coverage (no Subject Preference weighting). One attempt per
// exam, like the real thing.

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type Exam = { id: string; name: string };
type Config = { questionCount: number; durationMinutes: number; marksPerQuestion: number; negativeMarkingFraction: number };
type State =
  | { access: 'FREE_LOCKED' }
  | { access: 'NOT_CONFIGURED' }
  | { access: 'READY'; config: Config }
  | { access: 'IN_PROGRESS'; attemptId: string; expiresAt: string; config: Config }
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
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [state, setState] = useState<State | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [starting, setStarting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    studentFetch('/subject-preference/exams')
      .then((r) => r.json())
      .then((data: Exam[]) => {
        setExams(data);
        if (data.length > 0) setSelectedExamId(data[0].id);
      });
  }, []);

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
      body: JSON.stringify({ questionId, selectedOption: option }),
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
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.menu.liveExam}</h1>
        {state?.access === 'IN_PROGRESS' && (
          <span style={{ marginLeft: 'auto', fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: 800, color: remainingSeconds < 300 ? '#B4544A' : COLORS.ink }}>
            {formatTime(remainingSeconds)}
          </span>
        )}
      </div>

      {state?.access !== 'IN_PROGRESS' && exams.length > 0 && (
        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          style={{ display: 'block', width: '100%', padding: 10, marginBottom: 20, borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 14 }}
        >
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      )}

      {!state && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {state?.access === 'FREE_LOCKED' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 14, padding: 24, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.liveExamPage.lockedTitle}</p>
          <p style={{ fontSize: 13, color: '#5C4009', marginBottom: 16 }}>{t.liveExamPage.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {state?.access === 'NOT_CONFIGURED' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.liveExamPage.notConfigured}</p>
        </div>
      )}

      {state?.access === 'READY' && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, marginBottom: 12 }}>{t.liveExamPage.readyTitle}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 20, fontSize: 13, color: COLORS.inkMuted }}>
            <span>{state.config.questionCount} {t.liveExamPage.questions}</span>
            <span>{state.config.durationMinutes} {t.liveExamPage.minutes}</span>
            {state.config.negativeMarkingFraction > 0 && <span>-{state.config.negativeMarkingFraction} {t.liveExamPage.negMark}</span>}
          </div>
          <p style={{ fontSize: 12, color: '#B4544A', marginBottom: 16 }}>{t.liveExamPage.oneAttemptWarning}</p>
          <button onClick={start} disabled={starting} style={{ padding: '12px 28px', borderRadius: 10, background: COLORS.ink, color: COLORS.paper, border: 'none', fontWeight: 600 }}>
            {starting ? '…' : t.liveExamPage.startExam}
          </button>
        </div>
      )}

      {state?.access === 'IN_PROGRESS' && questions && questions[currentIndex] && (
        <div>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, fontWeight: 600, marginBottom: 12 }}>
            {currentIndex + 1} / {questions.length}
          </p>
          <p style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5, marginBottom: 16 }}>{questions[currentIndex].questionText}</p>

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
                  gap: 10,
                  padding: '12px 14px',
                  border: `1.5px solid ${isSelected ? COLORS.ink : COLORS.line}`,
                  borderRadius: 10,
                  marginBottom: 8,
                  fontSize: 14,
                  cursor: 'pointer',
                  background: isSelected ? COLORS.paperAlt : COLORS.paper,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: COLORS.inkMuted }}>{letter}.</span>
                <span style={{ flex: 1, color: COLORS.ink }}>{text}</span>
              </div>
            );
          })}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${COLORS.line}`, background: COLORS.paper, color: COLORS.ink }}
            >
              {t.liveExamPage.previous}
            </button>
            {currentIndex < questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(currentIndex + 1)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: COLORS.ink, color: COLORS.paper, fontWeight: 600 }}
              >
                {t.liveExamPage.next}
              </button>
            ) : (
              <button
                onClick={() => submitExam((state as any).attemptId)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#B4544A', color: '#fff', fontWeight: 600 }}
              >
                {t.liveExamPage.submitExam}
              </button>
            )}
          </div>

          {/* Question number grid for quick navigation */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 20 }}>
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIndex(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: `1px solid ${i === currentIndex ? COLORS.ink : COLORS.line}`,
                  background: q.selectedOption ? COLORS.goldLight : COLORS.paper,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {state?.access === 'COMPLETED' && (
        <div style={{ textAlign: 'center' }}>
          {state.wasExpired && <p style={{ fontSize: 12, color: '#B4544A', marginBottom: 8 }}>{t.liveExamPage.timeUpNotice}</p>}
          <p style={{ fontFamily: FONT_FAMILY, fontSize: 42, fontWeight: 800, color: COLORS.gold, margin: '20px 0 4px' }}>
            {state.score} / {state.totalMarks}
          </p>
          <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 24 }}>{t.liveExamPage.examComplete}</p>
          <a href="/" style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600 }}>
            {t.dailyQuiz.backHome}
          </a>
        </div>
      )}
    </main>
  );
}
