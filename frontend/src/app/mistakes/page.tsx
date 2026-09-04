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
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.mistakes.title}</h1>
      </div>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 12 }}>{t.mistakes.subtitle}</p>
      <a
        href="/ask-ponna?context=mistakes"
        style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: COLORS.gold, textDecoration: 'underline', marginBottom: 16 }}
      >
        {t.askPonna.analyzeMyMistakes}
      </a>

      {!data && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {data?.access === 'FREE_LOCKED' && (
        <div style={{ border: `1px solid ${COLORS.gold}`, borderRadius: 14, padding: 24, background: COLORS.goldLight, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>🔒 {t.mistakes.lockedTitle}</p>
          <p style={{ fontSize: 13, color: '#5C4009', marginBottom: 16 }}>{t.mistakes.lockedBody}</p>
          <a href="/plans" style={{ display: 'inline-block', padding: '10px 20px', borderRadius: 8, background: COLORS.ink, color: COLORS.paper, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            {t.dailyQuiz.viewPlans}
          </a>
        </div>
      )}

      {data?.access === 'AVAILABLE' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['all', 'subject', 'recent'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `1px solid ${filter === f ? COLORS.gold : COLORS.line}`,
                  background: filter === f ? COLORS.goldLight : COLORS.paper,
                  color: filter === f ? '#5C4009' : COLORS.inkMuted,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t.mistakes.filters[f]}
              </button>
            ))}
          </div>

          {allItems.length === 0 && (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 28, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.mistakes.empty}</p>
            </div>
          )}

          {filter === 'subject' && data.grouped
            ? data.grouped.map((group) => (
                <div key={group.subject} style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: COLORS.inkMuted, marginBottom: 8 }}>{group.subject}</h2>
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
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <button onClick={onOpen} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }}>
        {item.subjectName && <span style={{ fontSize: 11, color: COLORS.gold, fontWeight: 700 }}>{item.subjectName}</span>}
        <p style={{ fontSize: 14, color: COLORS.ink, margin: '4px 0 0', lineHeight: 1.4 }}>{item.questionText}</p>
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
                  gap: 8,
                  padding: '10px 12px',
                  border: `1.5px solid ${isCorrectOption ? '#16a34a' : COLORS.line}`,
                  borderRadius: 8,
                  marginBottom: 6,
                  fontSize: 13,
                  cursor: result ? 'default' : 'pointer',
                  background: isCorrectOption ? '#f0fdf4' : COLORS.paper,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 12, color: COLORS.inkMuted }}>{letter}.</span>
                <span style={{ flex: 1 }}>{text}</span>
                {isCorrectOption && <span style={{ color: '#16a34a' }}>✓</span>}
              </div>
            );
          })}

          {result && (
            <p style={{ fontSize: 13, fontWeight: 700, color: result.isCorrect ? '#16a34a' : '#B4544A', marginTop: 8 }}>
              {result.isCorrect ? t.mistakes.corrected : t.mistakes.stillWrong}
            </p>
          )}
          {result?.explanation && <p style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 4 }}>{result.explanation}</p>}
        </div>
      )}
    </div>
  );
}
