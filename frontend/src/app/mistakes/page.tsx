'use client';

// Wrong Questions Review (finalized requirement) — pure review of a
// student's own past mistakes: question, their history, and the correct
// answer, with an optional explanation if one was written for the
// question. Not a quiz — nothing here is re-answerable, and no new quiz
// session is created; this just reads UserQuestionHistory.

import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/language-context';
import { studentFetch } from '../../lib/student-fetch';
import { StudentMenu } from '../../components/StudentMenu';
import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

type WrongQuestion = {
  answeredAt: string;
  difficulty: 'MEDIUM' | 'HARD';
  question: {
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: 'A' | 'B' | 'C' | 'D';
    explanationTa: string | null;
    explanationEn: string | null;
    language: 'TA' | 'EN';
    authority: { name: string } | null;
  };
};

export default function MistakesPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<WrongQuestion[] | null>(null);

  useEffect(() => {
    studentFetch('/students/me/wrong-questions')
      .then((r) => (r.ok ? r.json() : []))
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: COLORS.paper, minHeight: '100dvh', color: COLORS.ink }}>
      <BitterFontLinks />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <StudentMenu />
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 700, margin: 0, color: COLORS.ink }}>{t.mistakes.title}</h1>
      </div>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20 }}>{t.mistakes.subtitle}</p>

      {items === null && <p style={{ color: COLORS.inkMuted, fontSize: 13 }}>…</p>}

      {items?.length === 0 && (
        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: COLORS.inkMuted, margin: 0 }}>{t.mistakes.empty}</p>
        </div>
      )}

      {items?.map((item, i) => {
        const q = item.question;
        const explanation = q.language === 'TA' ? q.explanationTa : q.explanationEn;
        return (
          <div key={q.id + i} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              {q.authority && (
                <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.inkMuted, background: COLORS.paperAlt, padding: '2px 9px', borderRadius: 10 }}>
                  {q.authority.name}
                </span>
              )}
              <span style={{ fontSize: 11, color: COLORS.inkMuted }}>{new Date(item.answeredAt).toLocaleDateString()}</span>
            </div>

            <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5, marginBottom: 12 }}>{q.questionText}</p>

            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const text = { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD }[letter];
              const isCorrect = q.correctOption === letter;
              return (
                <div
                  key={letter}
                  style={{
                    fontSize: 13,
                    padding: '8px 10px',
                    borderRadius: 8,
                    marginBottom: 4,
                    background: isCorrect ? COLORS.goldLight : 'transparent',
                    color: isCorrect ? '#5C4009' : COLORS.inkMuted,
                    fontWeight: isCorrect ? 700 : 400,
                  }}
                >
                  {letter}. {text} {isCorrect && `✓ ${t.mistakes.correctAnswer}`}
                </div>
              );
            })}

            {explanation && <p style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 10, lineHeight: 1.5 }}>{explanation}</p>}
          </div>
        );
      })}
    </main>
  );
}
