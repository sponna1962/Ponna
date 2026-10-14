'use client';

// Mind Gym · Speed Math: 10 quick sums, 10 seconds each, typed answers.

import { useEffect, useRef, useState } from 'react';
import { GameShell, mgCard, mgPrimaryBtn } from '../../../components/MindGym';
import { ShareResultCard } from '../../../components/ShareResultCard';
import { MG_BAD, MG_CARD, MG_GOLD, MG_GOOD, MG_INK, MG_MUTED, MG_TEAL, pick, randInt, readBest, saveBest } from '../../../lib/mind-gym';

const COUNT = 10;
const SECONDS = 10;
const BEST_KEY = 'ponna_mg_best_math';

type Q = { text: string; answer: number };

function makeQuestion(): Q {
  const kind = pick(['add', 'sub', 'mul', 'pct'] as const);
  if (kind === 'add') { const a = randInt(12, 99); const b = randInt(12, 99); return { text: `${a} + ${b}`, answer: a + b }; }
  if (kind === 'sub') { const a = randInt(40, 150); const b = randInt(11, a - 5); return { text: `${a} − ${b}`, answer: a - b }; }
  if (kind === 'mul') { const a = randInt(3, 15); const b = randInt(3, 12); return { text: `${a} × ${b}`, answer: a * b }; }
  const p = pick([10, 20, 25, 50]); const base = pick([40, 60, 80, 120, 160, 200, 240, 400]);
  return { text: `${base} இன் ${p}%`, answer: (base * p) / 100 };
}

export default function SpeedMathPage() {
  const [phase, setPhase] = useState<'intro' | 'play' | 'over'>('intro');
  const [qs, setQs] = useState<Q[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [left, setLeft] = useState(SECONDS);
  const [feedback, setFeedback] = useState<null | { ok: boolean; correct: number }>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef(0);

  useEffect(() => { setBest(readBest(BEST_KEY)); }, []);

  // One tick per second while a question is open.
  useEffect(() => {
    if (phase !== 'play' || feedback) return;
    if (left <= 0) { settle(null); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, feedback, left]);

  useEffect(() => { if (phase === 'play' && !feedback) inputRef.current?.focus(); }, [phase, feedback, index]);

  // A correct answer moves on by itself after a short pause.
  useEffect(() => {
    if (phase !== 'play' || !feedback?.ok) return;
    const t = setTimeout(() => next(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, feedback, index]);

  function begin() {
    const seen = new Set<string>(); const list: Q[] = [];
    while (list.length < COUNT) { const q = makeQuestion(); if (!seen.has(q.text)) { seen.add(q.text); list.push(q); } }
    setQs(list); setIndex(0); setAnswer(''); setLeft(SECONDS); setFeedback(null); setScore(0); scoreRef.current = 0; setNewBest(false);
    setPhase('play');
  }

  function settle(value: number | null) {
    const q = qs[index];
    const ok = value !== null && value === q.answer;
    if (ok) { scoreRef.current += 1; setScore(scoreRef.current); }
    setFeedback({ ok, correct: q.answer });
  }

  function next() {
    if (index + 1 < qs.length) {
      setIndex(index + 1); setAnswer(''); setLeft(SECONDS); setFeedback(null);
      return;
    }
    if (scoreRef.current > best) { setBest(scoreRef.current); saveBest(BEST_KEY, scoreRef.current); setNewBest(true); }
    setPhase('over');
  }

  const q = qs[index];

  return (
    <GameShell title="Speed Math" subtitle="10 கணக்குகள். ஒவ்வொன்றுக்கும் 10 வினாடிகள்.">
      {phase === 'intro' && (
        <div style={mgCard}>
          <p style={{ margin: '0 0 16px', fontSize: 15.5 }}>கூட்டல், கழித்தல், பெருக்கல், சதவீதம் ஆகிய கணக்குகள் வரும். மனதிலேயே கணக்குப் போட்டு விடையைத் தட்டச்சு செய்யுங்கள்.</p>
          {best > 0 && <p style={{ margin: '0 0 14px', fontSize: 15, color: MG_GOLD, fontWeight: 700 }}>உங்கள் சிறந்த மதிப்பெண்: {best} / {COUNT}</p>}
          <button style={mgPrimaryBtn} onClick={begin}>தொடங்கு</button>
        </div>
      )}

      {phase === 'play' && q && (
        <form style={mgCard} onSubmit={(e) => { e.preventDefault(); if (feedback) { next(); return; } if (answer !== '') settle(Number(answer)); }}>
          <p style={{ margin: 0, fontSize: 13.5, color: MG_MUTED }}>கணக்கு {index + 1} / {qs.length}</p>
          <p style={{ margin: '12px 0 10px', fontSize: 34, fontWeight: 800, color: MG_INK }}>{q.text}</p>
          <div style={{ height: 6, background: 'var(--color-goldDisc)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{ height: '100%', width: `${(left / SECONDS) * 100}%`, background: left <= 3 ? MG_BAD : MG_GOLD, transition: 'width 1s linear' }} />
          </div>
          <input
            ref={inputRef}
            value={answer}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 6);
              setAnswer(v);
              // Right answer typed: accept it straight away, no button needed.
              if (v !== '' && Number(v) === q.answer) settle(Number(v));
            }}
            disabled={!!feedback}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-label="விடை"
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 30, textAlign: 'center', padding: 12, borderRadius: 10, border: `2px solid ${MG_TEAL}`, background: MG_CARD, color: MG_INK }}
          />
          {feedback ? (
            <>
              <p style={{ margin: '14px 0 12px', fontSize: 18, fontWeight: 700, color: feedback.ok ? MG_GOOD : MG_BAD }}>
                {feedback.ok ? 'சரி ✓' : `இல்லை — சரியான விடை ${feedback.correct}`}
              </p>
              {!feedback.ok && <button type="submit" style={mgPrimaryBtn}>{index + 1 < qs.length ? 'அடுத்த கணக்கு →' : 'முடிவைப் பார்க்க →'}</button>}
            </>
          ) : (
            <button type="submit" disabled={answer === ''} style={{ ...mgPrimaryBtn, marginTop: 14, opacity: answer === '' ? 0.45 : 1 }}>சரிபார்</button>
          )}
        </form>
      )}

      {phase === 'over' && (
        <div style={mgCard}>
          <p style={{ margin: 0, fontSize: 14, color: MG_MUTED }}>உங்கள் மதிப்பெண்</p>
          <p style={{ margin: '6px 0 8px', fontSize: 36, fontWeight: 800 }}>{score} / {COUNT}</p>
          {newBest && <p style={{ margin: '0 0 8px', color: MG_GOLD, fontWeight: 700 }}>உங்கள் புதிய சிறந்த மதிப்பெண்! 🎉</p>}
          {!newBest && best > 0 && <p style={{ margin: '0 0 8px', fontSize: 14.5, color: MG_MUTED }}>உங்கள் சிறந்த மதிப்பெண்: {best} / {COUNT}</p>}
          <p style={{ margin: '0 0 16px', fontSize: 14, color: MG_MUTED }}>தினமும் சில நிமிடங்கள் பயிற்சி செய்தால் வேகமும் தெளிவும் கூடும்.</p>
          <ShareResultCard title="Mind Gym — Speed Math" score={`${score} / ${COUNT}`} percent={(score / COUNT) * 100} />
          <button style={mgPrimaryBtn} onClick={begin}>மீண்டும் விளையாடு</button>
        </div>
      )}
    </GameShell>
  );
}
