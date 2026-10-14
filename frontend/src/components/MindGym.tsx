'use client';

// Shared look + the multiple-choice round used by Number Series, Odd One Out
// and Code Breaker (Mind Gym, Oct 2026).

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { COLORS, DISPLAY_FONT } from '../lib/brand-theme';
import { StudentMenu } from './StudentMenu';
import { MG_BAD, MG_GOLD, MG_GOOD, MG_INK, MG_PAPER, MG_TEAL, readBest, saveBest } from '../lib/mind-gym';

const SERIF = `'Noto Serif Tamil', ${DISPLAY_FONT}`;

export const mgCard: CSSProperties = {
  background: '#fff', border: '1px solid #e7dcc0', borderRadius: 16, padding: '22px 18px',
  boxShadow: '0 2px 10px rgba(15,47,51,0.06)', textAlign: 'center',
};
export const mgPrimaryBtn: CSSProperties = {
  display: 'block', width: '100%', padding: 16, borderRadius: 12, border: 'none',
  background: MG_TEAL, color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: SERIF,
};

/** Same top bar as Study Notes: menu (with back arrow + logo) and page name. */
export function MindGymHeader() {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff' }}>
      <StudentMenu iconColor="#fff" />
      <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 700, margin: 0, color: '#fff' }}>Mind Gym</h1>
    </div>
  );
}

export function GameShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: MG_PAPER, color: MG_INK, fontFamily: SERIF }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <MindGymHeader />
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px' }}>
        <Link href="/mind-gym" style={{ color: MG_TEAL, fontSize: 14, textDecoration: 'none' }}>← Mind Gym</Link>
        <h2 style={{ fontSize: 24, margin: '12px 0 4px' }}>{title}</h2>
        <p style={{ fontSize: 14.5, color: '#4b5d5f', margin: '0 0 16px' }}>{subtitle}</p>
        {children}
      </div>
      <style>{`@keyframes mgshrink { from { width: 100%; } to { width: 0%; } }`}</style>
    </main>
  );
}

export type ChoiceQuestion = {
  prompt: string;
  /** Optional id used only to avoid asking the same question twice in a round. */
  key?: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

/** A round of `count` multiple-choice questions. The student's own best score
 * is kept per game in this browser. */
export function ChoiceGame({
  title, subtitle, intro, bestKey, count = 8, makeQuestion, bigPrompt = false,
}: {
  title: string; subtitle: string; intro: string; bestKey: string; count?: number;
  makeQuestion: () => ChoiceQuestion; bigPrompt?: boolean;
}) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>('intro');
  const [questions, setQuestions] = useState<ChoiceQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);

  useEffect(() => { setBest(readBest(bestKey)); }, [bestKey]);

  function begin() {
    const seen = new Set<string>();
    const qs: ChoiceQuestion[] = [];
    let guard = 0;
    while (qs.length < count && guard++ < count * 20) {
      const q = makeQuestion();
      const k = q.key ?? q.prompt;
      if (seen.has(k)) continue;
      seen.add(k);
      qs.push(q);
    }
    setQuestions(qs);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setNewBest(false);
    setPhase('play');
  }

  function choose(i: number) {
    if (chosen !== null) return;
    setChosen(i);
    if (i === questions[index].answerIndex) setScore((s) => s + 1);
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setChosen(null);
      return;
    }
    if (score > best) {
      setBest(score);
      saveBest(bestKey, score);
      setNewBest(true);
    }
    setPhase('over');
  }

  const q = questions[index];

  return (
    <GameShell title={title} subtitle={subtitle}>
      {phase === 'intro' && (
        <div style={mgCard}>
          <p style={{ margin: '0 0 16px', fontSize: 15.5 }}>{intro}</p>
          {best > 0 && <p style={{ margin: '0 0 14px', fontSize: 15, color: MG_GOLD, fontWeight: 700 }}>உங்கள் சிறந்த மதிப்பெண்: {best} / {count}</p>}
          <button style={mgPrimaryBtn} onClick={begin}>தொடங்கு</button>
        </div>
      )}

      {phase === 'play' && q && (
        <div style={mgCard}>
          <p style={{ margin: 0, fontSize: 13.5, color: '#4b5d5f' }}>கேள்வி {index + 1} / {questions.length}</p>
          <p style={{ margin: '12px 0 16px', fontSize: bigPrompt ? 26 : 17, fontWeight: bigPrompt ? 800 : 600, lineHeight: 1.6, letterSpacing: bigPrompt ? '0.08em' : 0 }}>{q.prompt}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {q.options.map((o, i) => {
              const isAnswer = i === q.answerIndex;
              const isChosen = chosen === i;
              const bg = chosen === null ? '#fff' : isAnswer ? '#e6f4ea' : isChosen ? '#fbe9e7' : '#fff';
              const border = chosen === null ? '#d9cfb0' : isAnswer ? MG_GOOD : isChosen ? MG_BAD : '#d9cfb0';
              return (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  disabled={chosen !== null}
                  style={{ padding: '13px 12px', borderRadius: 10, border: `2px solid ${border}`, background: bg, color: MG_INK, fontSize: 17, fontWeight: 600, cursor: chosen === null ? 'pointer' : 'default', fontFamily: SERIF }}
                >
                  {o}{chosen !== null && isAnswer ? '  ✓' : chosen !== null && isChosen ? '  ✕' : ''}
                </button>
              );
            })}
          </div>
          {chosen !== null && (
            <>
              <p style={{ margin: '14px 0 12px', fontSize: 14.5, color: '#4b5d5f', lineHeight: 1.6 }}>{q.explanation}</p>
              <button style={mgPrimaryBtn} onClick={next}>{index + 1 < questions.length ? 'அடுத்த கேள்வி →' : 'முடிவைப் பார்க்க →'}</button>
            </>
          )}
        </div>
      )}

      {phase === 'over' && (
        <div style={mgCard}>
          <p style={{ margin: 0, fontSize: 14, color: '#4b5d5f' }}>உங்கள் மதிப்பெண்</p>
          <p style={{ margin: '6px 0 8px', fontSize: 36, fontWeight: 800 }}>{score} / {questions.length}</p>
          {newBest && <p style={{ margin: '0 0 8px', color: MG_GOLD, fontWeight: 700 }}>உங்கள் புதிய சிறந்த மதிப்பெண்! 🎉</p>}
          {!newBest && best > 0 && <p style={{ margin: '0 0 8px', fontSize: 14.5, color: '#4b5d5f' }}>உங்கள் சிறந்த மதிப்பெண்: {best} / {count}</p>}
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4b5d5f' }}>தினமும் சில நிமிடங்கள் பயிற்சி செய்தால் வேகமும் தெளிவும் கூடும்.</p>
          <button style={mgPrimaryBtn} onClick={begin}>மீண்டும் விளையாடு</button>
        </div>
      )}
    </GameShell>
  );
}
