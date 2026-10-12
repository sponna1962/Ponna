'use client';

// Free start (Oct 2026, explicit request): a visitor taps "இலவசமாகப் பயிற்சி
// தொடங்குங்கள்" on Home and lands here -- pick a language, answer 5 real
// Group 4 questions with an instant right/wrong + explanation, and only
// AFTER the 5th is asked to sign up (free) to carry on. No phone number, no
// sign-up wall before the first question. Progress lives in this page's
// own state; the server stores nothing about the visitor.

import { useState } from 'react';
import Image from 'next/image';
import { apiUrl } from '../../lib/api-config';
import { rememberAfterLogin } from '../../lib/after-login';
import { DISPLAY_FONT } from '../../lib/brand-theme';

const PAPER = '#FBF6E9';
const INK = '#0F2F33';
const TEAL = '#1c6b6b';
const GOLD = '#C98A12';
const SERIF = `'Noto Serif Tamil', ${DISPLAY_FONT}`;

type Lang = 'TA' | 'EN';
type Q = { sequenceNumber: number; id: string; questionText: string; optionA: string; optionB: string; optionC: string; optionD: string };
type Checked = { isCorrect: boolean; correctOption: 'A' | 'B' | 'C' | 'D'; explanation: string | null };

const KEYS = ['A', 'B', 'C', 'D'] as const;
const LABELS: Record<Lang, string[]> = { TA: ['அ', 'ஆ', 'இ', 'ஈ'], EN: ['A', 'B', 'C', 'D'] };

const TEXT = {
  TA: {
    title: 'இலவசமாகப் பயிற்சி தொடங்குங்கள்',
    sub: 'பதிவு தேவையில்லை. 5 கேள்விகள், உடனே விளக்கத்துடன்.',
    pick: 'எந்த மொழியில் பயிற்சி செய்ய விரும்புகிறீர்கள்?',
    loading: 'கேள்விகள் தயாராகின்றன…',
    error: 'கேள்விகளைப் பெற முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலுங்கள்.',
    retry: 'மீண்டும் முயல்க',
    qOf: (n: number) => `கேள்வி ${n} / 5`,
    correct: 'சரி!',
    wrong: (a: string) => `இல்லை, சரியான விடை ${a}.`,
    next: 'அடுத்த கேள்வி →',
    finish: 'முடிவைப் பார்க்க →',
    touch: 'ஒன்றைத் தொடுங்கள்',
    doneTitle: 'நன்றாகச் செய்தீர்கள்!',
    score: (c: number) => `5 கேள்விகளில் ${c} சரியாகச் செய்தீர்கள்.`,
    cta: 'தொடர்ந்து இலவசமாகப் பயிற்சி செய்ய, பதிவு செய்யுங்கள்',
    ctaSub: 'Google அல்லது மொபைல் எண் மூலம் சில விநாடிகளில் பதிவு செய்யலாம். தினமும் இலவசக் கேள்விகள், Daily Quiz, பாடக் குறிப்புகள் உங்களுக்காக.',
    signup: 'இலவசமாகப் பதிவு செய்யுங்கள் →',
    home: 'இப்போதைக்கு வேண்டாம், Home-க்கு செல்ல',
  },
  EN: {
    title: 'Start practising free',
    sub: 'No sign-up needed. 5 questions, with instant explanations.',
    pick: 'Which language would you like to practise in?',
    loading: 'Getting your questions ready…',
    error: 'Could not load the questions. Please check your connection and try again.',
    retry: 'Try again',
    qOf: (n: number) => `Question ${n} / 5`,
    correct: 'Correct!',
    wrong: (a: string) => `Not quite — the right answer is ${a}.`,
    next: 'Next question →',
    finish: 'See my result →',
    touch: 'Tap one',
    doneTitle: 'Well done!',
    score: (c: number) => `You got ${c} of 5 right.`,
    cta: 'Sign up free to keep practising',
    ctaSub: 'Sign up in seconds with Google or a mobile number. Free daily questions, the Daily Quiz and study notes are waiting for you.',
    signup: 'Sign up free →',
    home: 'Not now, take me Home',
  },
} as const;

/** Funnel counter: reuses the anonymous visit counter with a path per step,
 * so the admin Visitors page shows how many people reach each step. Never
 * blocks or breaks the page. */
function trackStep(step: string) {
  try {
    const visitorId = localStorage.getItem('ponna_vid');
    if (!visitorId || localStorage.getItem('ponna_staff_token')) return;
    void fetch(apiUrl('/track/visit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId, path: `/free-practice/${step}`, isEntry: false }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* tracking must never affect the page */ }
}

export default function FreePracticePage() {
  const [lang, setLang] = useState<Lang | null>(null);
  const [questions, setQuestions] = useState<Q[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const t = TEXT[lang ?? 'TA'];

  async function load(language: Lang) {
    setLang(language);
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(apiUrl(`/guest-practice/questions?language=${language}`));
      if (!res.ok) throw new Error('load failed');
      const data: Q[] = await res.json();
      setQuestions(data);
      setIndex(0);
      setPicked(null);
      setChecked(null);
      setCorrectCount(0);
      setDone(false);
      trackStep('started');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function choose(key: string) {
    if (!questions || checked || checking) return;
    setPicked(key);
    setChecking(true);
    try {
      const res = await fetch(apiUrl('/guest-practice/answer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: questions[index].id, selectedOption: key }),
      });
      if (!res.ok) throw new Error('check failed');
      const data: Checked = await res.json();
      setChecked(data);
      if (data.isCorrect) setCorrectCount((c) => c + 1);
      if (index === 0) trackStep('q1-answered');
    } catch {
      setPicked(null); // let the visitor tap again
    } finally {
      setChecking(false);
    }
  }

  function next() {
    if (!questions) return;
    if (index + 1 >= questions.length) {
      setDone(true);
      trackStep('finished');
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setChecked(null);
  }

  function signUp() {
    trackStep('signup-click');
    rememberAfterLogin('/quiz'); // after signing up, carry on with normal practice
    window.location.href = '/?startLogin=1';
  }

  const header = (
    <div style={{ background: '#fefefe', borderBottom: '1px solid #eadfc4', padding: '10px 18px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <a href="/"><Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ height: 36, width: 'auto', display: 'block' }} /></a>
      </div>
    </div>
  );

  let body: React.ReactNode;

  if (!lang || (!questions && !loading && !error)) {
    body = (
      <>
        <h1 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 26, lineHeight: 1.5, margin: '8px 0 6px', color: INK }}>{TEXT.TA.title}</h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: '#4a5d59', margin: '0 0 22px' }}>{TEXT.TA.sub}</p>
        <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16.5, color: TEAL, margin: '0 0 12px' }}>{TEXT.TA.pick}</p>
        <button type="button" onClick={() => load('TA')} style={langBtn}>தமிழ்</button>
        <button type="button" onClick={() => load('EN')} style={langBtn}>English</button>
      </>
    );
  } else if (loading) {
    body = <p role="status" style={{ textAlign: 'center', color: TEAL, fontSize: 16, padding: '60px 0' }}>{t.loading}</p>;
  } else if (error || !questions) {
    body = (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: INK }}>{t.error}</p>
        <button type="button" onClick={() => load(lang)} style={{ ...primaryBtn, marginTop: 14 }}>{t.retry}</button>
      </div>
    );
  } else if (done) {
    body = (
      <div style={{ textAlign: 'center', paddingTop: 18 }}>
        <div style={{ fontSize: 46, lineHeight: 1 }} aria-hidden="true">🎉</div>
        <h1 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 27, margin: '12px 0 6px', color: INK }}>{t.doneTitle}</h1>
        <p style={{ fontSize: 18, fontWeight: 700, color: TEAL, margin: '0 0 22px' }}>{t.score(correctCount)}</p>
        <div style={{ background: '#fff', border: '1px solid #eadfc4', borderRadius: 12, padding: '18px 16px', boxShadow: '0 10px 30px -12px rgba(15,47,51,.3)' }}>
          <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 18.5, lineHeight: 1.55, margin: '0 0 8px', color: INK }}>{t.cta}</p>
          <p style={{ fontSize: 14, lineHeight: 1.75, color: '#4a5d59', margin: '0 0 16px' }}>{t.ctaSub}</p>
          <button type="button" onClick={signUp} style={primaryBtn}>{t.signup}</button>
        </div>
        <a href="/?skipWelcome=1" style={{ display: 'inline-block', marginTop: 18, fontSize: 13.5, color: '#2851A3', textDecoration: 'underline', textUnderlineOffset: 3 }}>{t.home}</a>
      </div>
    );
  } else {
    const q = questions[index];
    const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
    body = (
      <div style={{ background: '#fff', borderRadius: 10, padding: '18px 16px 14px', boxShadow: '0 10px 30px -12px rgba(15,47,51,.35)', border: '1px solid #eadfc4' }}>
        <div style={{ fontSize: 12.5, color: GOLD, fontWeight: 700, marginBottom: 8 }}>{t.qOf(index + 1)} · TNPSC Group 4</div>
        <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 19, lineHeight: 1.65, margin: '0 0 14px', color: INK }}>{q.questionText}</p>
        {opts.map((text, i) => {
          const key = KEYS[i];
          const isRight = !!checked && checked.correctOption === key;
          const isWrong = !!checked && picked === key && !checked.isCorrect;
          return (
            <button
              key={key}
              type="button"
              disabled={!!checked || checking}
              onClick={() => choose(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 50, textAlign: 'left',
                background: isRight ? '#E4F4E2' : isWrong ? '#FCE9E6' : PAPER,
                border: `1.5px solid ${isRight ? '#2e8b3d' : isWrong ? '#c0392b' : picked === key ? TEAL : '#e6dab8'}`,
                borderRadius: 8, padding: '12px 14px', marginBottom: 10, fontSize: 17, fontWeight: 500, color: INK,
                cursor: checked ? 'default' : 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none', fontSize: 12, fontWeight: 700,
                background: isRight ? '#2e8b3d' : isWrong ? '#c0392b' : '#fff', color: isRight || isWrong ? '#fff' : TEAL,
                border: `1.5px solid ${isRight ? '#2e8b3d' : isWrong ? '#c0392b' : TEAL}`,
              }}>{LABELS[lang][i]}</span>
              {text}
            </button>
          );
        })}
        {!checked && <p style={{ fontSize: 13, color: '#6f7f7a', textAlign: 'center', margin: '2px 0 0' }}>{t.touch}</p>}
        {checked && (
          <p role="status" style={{ fontSize: 14.5, lineHeight: 1.75, background: '#FFF6DA', borderRadius: 10, padding: '10px 12px', margin: '4px 0 0', color: INK }}>
            <b>{checked.isCorrect ? t.correct : t.wrong(LABELS[lang][KEYS.indexOf(checked.correctOption)])}</b>
            {checked.explanation ? ` ${checked.explanation}` : ''}
          </p>
        )}
        {checked && <button type="button" onClick={next} style={{ ...primaryBtn, marginTop: 16 }}>{index + 1 >= questions.length ? t.finish : t.next}</button>}
      </div>
    );
  }

  return (
    <main style={{ minHeight: '100dvh', background: PAPER, color: INK }}>
      {header}
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '18px 20px 40px' }}>{body}</div>
    </main>
  );
}

const langBtn: React.CSSProperties = {
  display: 'block', width: '100%', minHeight: 56, marginBottom: 12, background: '#fff', color: INK, fontWeight: 800, fontSize: 19,
  border: `2px solid ${TEAL}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
};
const primaryBtn: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'center', background: '#FFD22A', color: '#0B3864', fontWeight: 800, fontSize: 17.5,
  padding: 15, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
};
