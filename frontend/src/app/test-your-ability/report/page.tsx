'use client';

// Test Your Ability — full diagnostic report page (Sept 2026, explicit
// spec). Shown right after a guest completes signup and their attempt
// is claimed (see page.tsx's attemptLogin -- claim happens there, this
// page just fetches and displays the resulting report). Server-side
// enforces that the report is only ever returned once claimed by the
// requesting student -- see guest-diagnostic.service.ts's own
// getReport() comment.
//
// Sept 2026 (explicit requirement, follow-up) — a student who took the
// diagnostic in Tamil must see a FULLY Tamil report (every label,
// heading, and sentence, not just the question content), and an
// English-taker a fully English one -- report.language (the language
// the diagnostic was actually taken in, stored server-side at
// startAttempt time) drives every string on this page via the L()
// lookup below, never a mix of the two languages.
//
// Deliberately measures performance only, never judges the student:
// no rank, no IQ/intelligence framing, no comparison with other
// students, no "weak"/"poor"/"failure" labels anywhere on this page --
// "did well" vs "needs more practice" are the only two framings used,
// both neutral and encouraging, computed server-side from the exact
// same real numbers.

import { useEffect, useState } from 'react';
import { studentFetch } from '../../../lib/student-fetch';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';

type QuestionReviewItem = {
  sequenceNumber: number;
  isCorrect: boolean | null;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string | null;
  selectedText: string | null;
  correctOption: string;
  correctText: string;
  explanation: string | null;
};

type Report = {
  language: 'TA' | 'EN';
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  subjectBreakdown: { subject: string; correct: number; total: number; accuracy: number }[];
  didWell: string[];
  needsPractice: string[];
  questionReview: QuestionReviewItem[];
};

const STRINGS = {
  title: { TA: 'உங்க Diagnostic Result', EN: 'Your Diagnostic Result' },
  loading: { TA: '…', EN: '…' },
  notFound: { TA: 'எந்த diagnostic result-உம் கிடைக்கவில்லை.', EN: 'No diagnostic result was found.' },
  loadFailed: { TA: 'Result-ஐ ஏற்ற முடியவில்லை.', EN: 'Could not load the result.' },
  score: { TA: 'Score', EN: 'Score' },
  accuracyLabel: { TA: 'Accuracy', EN: 'Accuracy' },
  correctLabel: { TA: 'சரி', EN: 'Correct' },
  wrongLabel: { TA: 'தப்பு', EN: 'Wrong' },
  subjectWiseHeading: { TA: 'பாடம்-வாரியான Performance', EN: 'Subject-wise Performance' },
  colSubject: { TA: 'பாடம்', EN: 'Subject' },
  colCorrect: { TA: 'சரியானது', EN: 'Correct' },
  colTotal: { TA: 'மொத்தம்', EN: 'Total' },
  colAccuracy: { TA: 'Accuracy', EN: 'Accuracy' },
  didWellPrefix: { TA: 'நன்றாகச் செய்த பகுதிகள்:', EN: 'Areas you did well in:' },
  needsPracticePrefix: { TA: 'மேலும் பயிற்சி செய்ய வேண்டிய பகுதிகள்:', EN: 'Areas to practise more:' },
  questionWiseHeading: { TA: 'கேள்வி-வாரியான Review', EN: 'Question-wise Review' },
  yourAnswer: { TA: 'உங்க பதில்:', EN: 'Your answer:' },
  noAnswer: { TA: '(பதில் இல்லை)', EN: '(no answer)' },
  correctAnswer: { TA: 'சரியான பதில்:', EN: 'Correct answer:' },
  insightDidWellSuffix: { TA: ' பகுதியில் நல்ல செயல்திறன் உள்ளது. ', EN: ' -- good performance in this area. ' },
  insightNeedsPracticeSuffix: { TA: ' பகுதிகளில் மேலும் பயிற்சி செய்வது பயனுள்ளதாக இருக்கும்.', EN: ' -- practising more here would help.' },
  nextPracticeHeading: { TA: 'அடுத்து என்ன பயிற்சி செய்யலாம்?', EN: 'What to practise next?' },
  nextPracticeSuffix: { TA: ' பகுதிகளில் கூடுதல் பயிற்சி செய்யுங்கள்.', EN: ' -- do extra practice in these areas.' },
  continueButton: { TA: 'தொடர் பயிற்சியைத் தொடங்குங்கள்', EN: 'Start Continued Practice' },
} as const;

export default function TestYourAbilityReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  const lang = report?.language ?? 'TA';
  const L = (key: keyof typeof STRINGS) => STRINGS[key][lang];

  useEffect(() => {
    const guestId = localStorage.getItem('ponna_guest_diagnostic_id');
    if (!guestId) {
      setError(STRINGS.notFound.TA);
      setLoading(false);
      return;
    }
    studentFetch(`/guest-diagnostic/${guestId}/report`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) {
          setError(body.error ?? STRINGS.loadFailed.TA);
          return;
        }
        setReport(body);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', padding: 20, background: COLORS.paper, color: COLORS.ink }}>
      <BitterFontLinks />
      <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 22, fontWeight: 800, marginBottom: 16 }}>{L('title')}</h1>

      {loading && <p style={{ fontSize: 13, color: COLORS.inkMuted }}>{STRINGS.loading.TA}</p>}
      {error && <p style={{ fontSize: 13, color: '#b91c1c' }}>{error}</p>}

      {report && (
        <>
          {/* A. Overall Performance */}
          <div style={{ textAlign: 'center', border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, marginBottom: 20 }}>
            <p style={{ fontFamily: FONT_FAMILY, fontSize: 40, fontWeight: 800, color: COLORS.gold, margin: '0 0 4px' }}>
              {report.correctCount} / {report.totalQuestions}
            </p>
            <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 14 }}>{L('score')}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 13, flexWrap: 'wrap' }}>
              <span>
                <strong>{report.accuracy}%</strong> {L('accuracyLabel')}
              </span>
              <span>
                ✓ <strong>{report.correctCount}</strong> {L('correctLabel')}
              </span>
              <span>
                ✕ <strong>{report.wrongCount}</strong> {L('wrongLabel')}
              </span>
            </div>
          </div>

          {/* B. Subject-wise Performance */}
          <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {L('subjectWiseHeading')}
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `2px solid ${COLORS.line}` }}>
                <th style={{ padding: '6px 4px' }}>{L('colSubject')}</th>
                <th style={{ padding: '6px 4px', textAlign: 'center' }}>{L('colCorrect')}</th>
                <th style={{ padding: '6px 4px', textAlign: 'center' }}>{L('colTotal')}</th>
                <th style={{ padding: '6px 4px', textAlign: 'right' }}>{L('colAccuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {report.subjectBreakdown.map((s) => (
                <tr key={s.subject} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                  <td style={{ padding: '8px 4px' }}>{s.subject}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>{s.correct}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>{s.total}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: 700 }}>{s.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {report.didWell.length > 0 && (
            <p style={{ fontSize: 13, color: '#166534', marginBottom: 6 }}>
              <strong>{L('didWellPrefix')}</strong> {report.didWell.join(', ')}
            </p>
          )}
          {report.needsPractice.length > 0 && (
            <p style={{ fontSize: 13, color: COLORS.ink, marginBottom: 20 }}>
              <strong>{L('needsPracticePrefix')}</strong> {report.needsPractice.join(', ')}
            </p>
          )}

          {/* C. Question-wise Performance */}
          <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {L('questionWiseHeading')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {report.questionReview.map((q) => (
              <button
                key={q.sequenceNumber}
                onClick={() => setExpandedQ(expandedQ === q.sequenceNumber ? null : q.sequenceNumber)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: `1.5px solid ${q.isCorrect ? '#166534' : '#B4544A'}`,
                  background: expandedQ === q.sequenceNumber ? (q.isCorrect ? '#166534' : '#B4544A') : COLORS.paper,
                  color: expandedQ === q.sequenceNumber ? '#fff' : q.isCorrect ? '#166534' : '#B4544A',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {q.sequenceNumber} {q.isCorrect ? '✓' : '✕'}
              </button>
            ))}
          </div>

          {expandedQ !== null &&
            (() => {
              const q = report.questionReview.find((x) => x.sequenceNumber === expandedQ)!;
              return (
                <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
                  <p style={{ fontWeight: 600, marginBottom: 8, whiteSpace: 'pre-wrap' }}>{q.questionText}</p>
                  <p style={{ marginBottom: 4 }}>
                    {L('yourAnswer')}{' '}
                    <strong style={{ color: q.isCorrect ? '#166534' : '#B4544A' }}>
                      {q.selectedOption ? `${q.selectedOption}) ${q.selectedText}` : L('noAnswer')}
                    </strong>
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    {L('correctAnswer')} <strong style={{ color: '#166534' }}>{q.correctOption}) {q.correctText}</strong>
                  </p>
                  {q.explanation && (
                    <div style={{ background: COLORS.paperAlt, borderRadius: 8, padding: 10, marginTop: 8, whiteSpace: 'pre-wrap' }}>{q.explanation}</div>
                  )}
                </div>
              );
            })()}

          {/* D. Performance Insight */}
          {(report.didWell.length > 0 || report.needsPractice.length > 0) && (
            <div style={{ background: COLORS.goldLight, border: `1px solid ${COLORS.gold}`, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13.5, lineHeight: 1.6 }}>
              {report.didWell.length > 0 && (
                <>
                  {report.didWell.join(', ')}
                  {L('insightDidWellSuffix')}
                </>
              )}
              {report.needsPractice.length > 0 && (
                <>
                  {report.needsPractice.join(', ')}
                  {L('insightNeedsPracticeSuffix')}
                </>
              )}
            </div>
          )}

          {/* E. Next Practice Recommendation */}
          <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {L('nextPracticeHeading')}
          </p>
          {report.needsPractice.length > 0 && (
            <p style={{ fontSize: 13.5, color: COLORS.ink, marginBottom: 16, lineHeight: 1.6 }}>
              {report.needsPractice.join(', ')}
              {L('nextPracticeSuffix')}
            </p>
          )}

          <a
            href="/quiz"
            style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 700, marginTop: 8 }}
          >
            {L('continueButton')}
          </a>
        </>
      )}
    </main>
  );
}
