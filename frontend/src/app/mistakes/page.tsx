'use client';

// Review Mistakes (finalized requirement) — a REVISION/practice flow,
// strictly separate from normal Practice. Answering a question here never
// touches UserQuestionHistory, Performance, Rank, the Free 5/day quota, or
// Subject/Topic Preference allocation — those are all untouched by this
// page. A question leaves this list once answered correctly here (marked
// CORRECTED); answering wrong again just leaves it PENDING for next time.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type MistakeItem = {
  questionId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  subjectName: string | null;
  mistakenAt: string;
};

type ListResponse = { access: 'FREE_LOCKED' } | { access: 'AVAILABLE'; items?: MistakeItem[]; grouped?: { subject: string; questions: MistakeItem[] }[] };

type Filter = 'all' | 'subject' | 'recent';

export default function MistakesPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState<Filter>('all');
  const [data, setData] = useState<ListResponse | null>(null);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; correctOption: string; explanation: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Sept 2026 — Mistake-Driven Smart Revision (differentiated feature):
  // on-demand, generated from THIS student's own pending mistakes.
  const [revisionSummary, setRevisionSummary] = useState<{ summary: string; questionCount: number; subjectCount: number } | null>(null);
  const [generatingRevision, setGeneratingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  async function generateSmartRevision() {
    setGeneratingRevision(true);
    setRevisionError(null);
    try {
      const res = await studentFetch('/students/me/smart-revision', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) {
        setRevisionError(body.error ?? 'Failed to generate revision summary');
        return;
      }
      setRevisionSummary(body);
    } finally {
      setGeneratingRevision(false);
    }
  }

  function load() {
    studentFetch(`/students/me/mistakes?filter=${filter}`)
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(load, [filter]);

  async function submitReview(questionId: string, option: string) {
    setSubmitting(true);
    const res = await studentFetch(`/students/me/mistakes/${questionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedOption: option }),
    });
    const body = await res.json();
    setSubmitting(false);
    setResult(body);
    if (body.isCorrect) {
      // Correct — reload the list after a short pause so the student sees
      // the "Corrected" confirmation before it disappears from PENDING.
      setTimeout(() => {
        setOpenQuestionId(null);
        setResult(null);
        load();
      }, 1400);
    }
  }

  function openQuestion(questionId: string) {
    setOpenQuestionId(openQuestionId === questionId ? null : questionId);
    setResult(null);
  }

  const allItems: MistakeItem[] =
    data?.access === 'AVAILABLE' ? data.items ?? data.grouped?.flatMap((g) => g.questions) ?? [] : [];

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 0, paddingBottom: 30, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, marginBottom: 16, background: 'linear-gradient(180deg,var(--color-head1),var(--color-head2))', borderBottom: '3px solid #E2B04A', color: '#fff' }}>
        <StudentMenu iconColor="#fff" />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>{t.mistakes.title}</h1>
      </div>
      <div style={{ padding: '0 16px' }}>
      <p style={{ fontSize: 14, color: COLORS.inkMuted, lineHeight: 1.6, margin: '0 0 12px' }}>{t.mistakes.subtitle}</p>
      <a
        href="/ask-ponna?context=mistakes"
        style={{ display: 'inline-block', fontSize: 13.5, fontWeight: 700, color: COLORS.gold, textDecoration: 'underline', marginBottom: 14, lineHeight: 1.5 }}
      >
        {t.askPonna.analyzeMyMistakes}
      </a>

      {/* Sept 2026 — Mistake-Driven Smart Revision (differentiated
          feature): on-demand, generated from THIS student's own pending
          mistakes -- never a static, same-for-everyone note. */}
      <button
        onClick={generateSmartRevision}
        disabled={generatingRevision}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '14px 16px', borderRadius: 16, border: '1.5px solid #E2B04A', background: 'var(--color-goldDisc)', color: COLORS.ink, fontWeight: 700, fontSize: 14.5, cursor: 'pointer', marginBottom: 16 }}
      >
        <span style={{ flex: 1 }}>{generatingRevision ? 'உங்க mistakes-ஐ படிச்சு revision notes தயார் பண்றேன்…' : '✨ என் Mistakes-க்கான Smart Revision Notes'}</span>
        <span aria-hidden="true" style={{ fontSize: 24, color: 'var(--color-gold)', lineHeight: 1 }}>›</span>
      </button>
      {revisionError && <p style={{ fontSize: 13, color: 'var(--color-bad)', marginBottom: 16 }}>{revisionError}</p>}
      {revisionSummary && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderLeft: '5px solid #E2B04A', borderRadius: 16, padding: 16, marginBottom: 16, background: 'var(--color-card)', color: COLORS.ink, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.7 }}>
          <p style={{ fontSize: 12.5, color: 'var(--color-gold)', marginBottom: 8, fontWeight: 700 }}>
            உங்க {revisionSummary.questionCount} mistakes-லிருந்து ({revisionSummary.subjectCount} subjects)
          </p>
          {revisionSummary.summary}
        </div>
      )}

      {!data && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {data?.access === 'FREE_LOCKED' && (
        <div style={{ border: '1.5px solid #E2B04A', borderRadius: 16, padding: 22, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.mistakes.lockedTitle}</p>
          <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginBottom: 16 }}>{t.mistakes.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '11px 24px', borderRadius: 14, background: 'var(--color-btn)', color: 'var(--color-btnText)', textDecoration: 'none', fontWeight: 700, fontSize: 14.5 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {data?.access === 'AVAILABLE' && (
        <>
          <div style={{ display: 'flex', gap: 6, background: 'var(--color-field)', border: `1px solid ${COLORS.line}`, borderRadius: 999, padding: 4, marginBottom: 16 }}>
            {(['all', 'subject', 'recent'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  borderRadius: 999,
                  border: 'none',
                  background: filter === f ? 'var(--color-btn)' : 'transparent',
                  color: filter === f ? 'var(--color-btnText)' : COLORS.inkMuted,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t.mistakes.filters[f]}
              </button>
            ))}
          </div>

          {allItems.length === 0 && (
            <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: '30px 18px', textAlign: 'center' }}>
              <span style={{ display: 'block', fontSize: 36, marginBottom: 8 }}>🎉</span>
              <p style={{ fontSize: 15, color: COLORS.inkMuted, margin: 0 }}>{t.mistakes.empty}</p>
            </div>
          )}

          {filter === 'subject' && data.grouped
            ? data.grouped.map((group) => (
                <div key={group.subject} style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: '0 0 8px' }}>{group.subject}</h2>
                  {group.questions.map((item) => (
                    <MistakeCard
                      key={item.questionId}
                      item={item}
                      isOpen={openQuestionId === item.questionId}
                      result={openQuestionId === item.questionId ? result : null}
                      submitting={submitting}
                      onOpen={() => openQuestion(item.questionId)}
                      onAnswer={(opt) => submitReview(item.questionId, opt)}
                    />
                  ))}
                </div>
              ))
            : (data.items ?? []).map((item) => (
                <MistakeCard
                  key={item.questionId}
                  item={item}
                  isOpen={openQuestionId === item.questionId}
                  result={openQuestionId === item.questionId ? result : null}
                  submitting={submitting}
                  onOpen={() => openQuestion(item.questionId)}
                  onAnswer={(opt) => submitReview(item.questionId, opt)}
                />
              ))}
        </>
      )}
      </div>
    </main>
  );
}

function MistakeCard({
  item,
  isOpen,
  result,
  submitting,
  onOpen,
  onAnswer,
}: {
  item: MistakeItem;
  isOpen: boolean;
  result: { isCorrect: boolean; correctOption: string; explanation: string | null } | null;
  submitting: boolean;
  onOpen: () => void;
  onAnswer: (option: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div style={{ background: 'var(--color-card)', border: `1px solid ${COLORS.line}`, borderLeft: '5px solid #E2B04A', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        {item.subjectName && <span style={{ display: 'inline-block', fontSize: 12, color: 'var(--color-gold)', fontWeight: 700, background: 'var(--color-goldDisc)', padding: '3px 10px', borderRadius: 999 }}>{item.subjectName}</span>}
        <p style={{ fontSize: 15.5, color: COLORS.ink, margin: '6px 0 0', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{item.questionText}</p>
      </button>

      {isOpen && (
        <div style={{ marginTop: 12 }}>
          {(['A', 'B', 'C', 'D'] as const).map((letter) => {
            const text = { A: item.optionA, B: item.optionB, C: item.optionC, D: item.optionD }[letter];
            const isCorrectOption = result && result.correctOption === letter;
            const isWrongSelected = result && !result.isCorrect && result.correctOption !== letter;
            return (
              <div
                key={letter}
                onClick={() => !result && !submitting && onAnswer(letter)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 13px',
                  border: `1.5px solid ${isCorrectOption ? 'var(--color-ok)' : isWrongSelected ? 'var(--color-bad)' : COLORS.line}`,
                  borderRadius: 14,
                  marginBottom: 8,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: COLORS.ink,
                  cursor: result ? 'default' : 'pointer',
                  background: isCorrectOption ? 'var(--color-okBg)' : isWrongSelected ? 'var(--color-badBg)' : 'var(--color-card)',
                }}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12.5, background: isCorrectOption ? 'var(--color-ok)' : 'var(--color-field)', border: `1.5px solid ${isCorrectOption ? 'var(--color-ok)' : COLORS.line}`, color: isCorrectOption ? '#fff' : COLORS.inkMuted }}>
                  {isCorrectOption ? '✓' : letter}
                </span>
                <span style={{ flex: 1 }}>{text}</span>
              </div>
            );
          })}

          {result && (
            <p style={{ fontSize: 14.5, fontWeight: 700, color: result.isCorrect ? 'var(--color-ok)' : 'var(--color-bad)', marginTop: 8 }}>
              {result.isCorrect ? t.mistakes.corrected : t.mistakes.stillWrong}
            </p>
          )}
          {result?.explanation && <p style={{ fontSize: 13.5, color: COLORS.inkMuted, marginTop: 4, lineHeight: 1.7 }}>{result.explanation}</p>}
        </div>
      )}
    </div>
  );
}
