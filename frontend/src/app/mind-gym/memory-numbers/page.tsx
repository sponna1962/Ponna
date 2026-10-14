'use client';

// Mind Gym · Memory Numbers (Oct 2026, requested): a number is shown briefly, hides, and
// the student types it back from memory. Each correct answer adds one digit.
// No sign-up, no server, no AI -- random digits made in the browser. The
// student's own best level is kept in this browser only; it is never compared
// with anyone else.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MindGymHeader } from '../../../components/MindGym';
import { DISPLAY_FONT } from '../../../lib/brand-theme';

const PAPER = 'var(--color-paper)';
const INK = 'var(--color-ink)';
const TEAL = '#1c6b6b';
const GOLD = '#C98A12';
const SERIF = `'Noto Serif Tamil', ${DISPLAY_FONT}`;

const START_DIGITS = 4;
const MAX_DIGITS = 12;
const TRIES_PER_LEVEL = 2;
const BEST_KEY = 'ponna_memory_best';

type Phase = 'intro' | 'show' | 'type' | 'right' | 'retry' | 'over';

function makeNumber(digits: number): string {
  let s = '';
  for (let i = 0; i < digits; i++) s += Math.floor(Math.random() * 10);
  return s;
}

// A little longer for longer numbers, so each level is fair.
function showMs(digits: number): number {
  return 2500 + (digits - START_DIGITS) * 400;
}

function readBest(): number {
  try {
    const v = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try { window.localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage unavailable */ }
}

export default function MemoryTestPage() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [digits, setDigits] = useState(START_DIGITS);
  const [target, setTarget] = useState('');
  const [answer, setAnswer] = useState('');
  const [triesLeft, setTriesLeft] = useState(TRIES_PER_LEVEL);
  const [reached, setReached] = useState(0); // highest level fully remembered
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setBest(readBest()); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (phase === 'type') inputRef.current?.focus(); }, [phase]);

  function startRound(d: number) {
    if (timer.current) clearTimeout(timer.current);
    setDigits(d);
    setTarget(makeNumber(d));
    setAnswer('');
    setPhase('show');
    timer.current = setTimeout(() => setPhase('type'), showMs(d));
  }

  function begin() {
    setReached(0);
    setNewBest(false);
    setTriesLeft(TRIES_PER_LEVEL);
    startRound(START_DIGITS);
  }

  function finish(levelReached: number) {
    if (levelReached > best) {
      setBest(levelReached);
      saveBest(levelReached);
      setNewBest(true);
    }
    setPhase('over');
  }

  function check() {
    if (answer.length !== digits) return;
    if (answer === target) {
      setReached(digits);
      if (digits >= MAX_DIGITS) return finish(digits);
      setPhase('right');
    } else if (triesLeft > 1) {
      setTriesLeft(triesLeft - 1);
      setPhase('retry');
    } else {
      finish(reached);
    }
  }

  function nextLevel() {
    setTriesLeft(TRIES_PER_LEVEL);
    startRound(digits + 1);
  }

  function retryLevel() {
    startRound(digits);
  }

  const card: React.CSSProperties = {
    background: 'var(--color-card)', border: '1px solid var(--color-line)', borderRadius: 16, padding: '22px 18px',
    boxShadow: '0 2px 10px rgba(15,47,51,0.06)', textAlign: 'center',
  };
  const primaryBtn: React.CSSProperties = {
    display: 'block', width: '100%', padding: 16, borderRadius: 12, border: 'none',
    background: TEAL, color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', fontFamily: SERIF,
  };
  const bigNumber: React.CSSProperties = {
    fontSize: 44, fontWeight: 800, letterSpacing: '0.18em', color: INK, margin: '18px 0 8px',
    fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all',
  };

  return (
    <main style={{ minHeight: '100vh', background: PAPER, color: INK, fontFamily: SERIF }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <MindGymHeader />
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px' }}>
        <Link href="/mind-gym" style={{ color: TEAL, fontSize: 14, textDecoration: 'none' }}>← Mind Gym</Link>
        <h2 style={{ fontSize: 24, margin: "12px 0 4px" }}>Memory Numbers</h2>
        <p style={{ fontSize: 14.5, color: 'var(--color-inkMuted)', margin: '0 0 16px' }}>
          எண்ணைப் பார்த்து நினைவில் வைத்துக்கொண்டு, மறைந்த பின் தட்டச்சு செய்யுங்கள்.
        </p>

        {phase === 'intro' && (
          <div style={card}>
            <p style={{ margin: '0 0 6px', fontSize: 16 }}>{START_DIGITS} இலக்க எண்ணில் தொடங்கும்.</p>
            <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--color-inkMuted)' }}>
              ஒவ்வொரு முறை சரியாகச் சொன்னாலும் ஓர் இலக்கம் கூடும். ஒவ்வொரு நிலையிலும் {TRIES_PER_LEVEL} வாய்ப்புகள் உண்டு.
            </p>
            {best > 0 && <p style={{ margin: '0 0 14px', fontSize: 15, color: GOLD, fontWeight: 700 }}>உங்கள் சிறந்த நிலை: {best} இலக்கங்கள்</p>}
            <button style={primaryBtn} onClick={begin}>தொடங்கு</button>
          </div>
        )}

        {phase === 'show' && (
          <div style={card} aria-live="polite">
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-inkMuted)' }}>{digits} இலக்கங்கள் — நினைவில் வைத்துக்கொள்ளுங்கள்</p>
            <div style={bigNumber}>{target}</div>
            <div style={{ height: 6, background: 'var(--color-goldDisc)', borderRadius: 3, overflow: 'hidden', marginTop: 14 }}>
              <div style={{ height: '100%', background: GOLD, animation: `memshrink ${showMs(digits)}ms linear forwards` }} />
            </div>
          </div>
        )}

        {phase === 'type' && (
          <form style={card} onSubmit={(e) => { e.preventDefault(); check(); }}>
            <p style={{ margin: '0 0 12px', fontSize: 15 }}>எண்ணைத் தட்டச்சு செய்யவும் ({digits} இலக்கங்கள்)</p>
            <input
              ref={inputRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value.replace(/\D/g, '').slice(0, digits))}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              aria-label="நினைவில் உள்ள எண்"
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 32, textAlign: 'center', letterSpacing: '0.2em', padding: 12, borderRadius: 10, border: `2px solid ${TEAL}`, background: 'var(--color-card)', color: INK }}
            />
            <button type="submit" disabled={answer.length !== digits} style={{ ...primaryBtn, marginTop: 14, opacity: answer.length === digits ? 1 : 0.45 }}>சரிபார்</button>
          </form>
        )}

        {phase === 'right' && (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#237a3b' }}>சரி! ✓</p>
            <p style={{ margin: '8px 0 16px', fontSize: 15 }}>{digits} இலக்கங்களை நினைவில் வைத்தீர்கள்.</p>
            <button style={primaryBtn} onClick={nextLevel}>அடுத்த நிலை ({digits + 1} இலக்கங்கள்) →</button>
          </div>
        )}

        {phase === 'retry' && (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#b3392b' }}>இல்லை</p>
            <p style={{ margin: '8px 0 4px', fontSize: 15 }}>சரியான எண்: <b style={{ letterSpacing: '0.15em' }}>{target}</b></p>
            <p style={{ margin: '0 0 16px', fontSize: 14.5, color: 'var(--color-inkMuted)' }}>இன்னும் {triesLeft} வாய்ப்பு உள்ளது. புதிய எண் காட்டப்படும்.</p>
            <button style={primaryBtn} onClick={retryLevel}>மீண்டும் முயல்க</button>
          </div>
        )}

        {phase === 'over' && (
          <div style={card}>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--color-inkMuted)' }}>சரியான எண்: <b style={{ letterSpacing: '0.15em' }}>{target}</b></p>
            <p style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 700 }}>
              {reached > 0 ? `${reached} இலக்கங்கள் வரை நினைவில் வைத்தீர்கள்` : 'இந்த முறை முடியவில்லை'}
            </p>
            {newBest && <p style={{ margin: '0 0 8px', color: GOLD, fontWeight: 700 }}>உங்கள் புதிய சிறந்த நிலை! 🎉</p>}
            {!newBest && best > 0 && <p style={{ margin: '0 0 8px', fontSize: 14.5, color: 'var(--color-inkMuted)' }}>உங்கள் சிறந்த நிலை: {best} இலக்கங்கள்</p>}
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-inkMuted)' }}>தினமும் சில நிமிடங்கள் பயிற்சி செய்தால் நினைவாற்றல் மேம்படும்.</p>
            <button style={primaryBtn} onClick={begin}>மீண்டும் விளையாடு</button>
          </div>
        )}
      </div>
      <style>{`@keyframes memshrink { from { width: 100%; } to { width: 0%; } }`}</style>
    </main>
  );
}
