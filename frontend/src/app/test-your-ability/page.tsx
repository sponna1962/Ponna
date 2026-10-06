'use client';

// Welcome Screen (Oct 2026 redesign, approved mockup "final"): a sunrise-
// over-paddy-fields illustration ("Ponna" = golden) with a path leading to
// the sun, the headline, and ONE fixed sample question the visitor can
// answer right here. The 20-question diagnostic itself is unchanged and
// still starts at /ask-ponna?guestDiagnostic=1.
// Copy is approved content -- unchanged without a further explicit request.

import { useState } from 'react';
import Image from 'next/image';
import { DISPLAY_FONT } from '../../lib/brand-theme';
import { HERO_ART_SVG } from './hero-art';

const PAPER = '#FBF6E9';
const INK = '#0F2F33';
const TEAL = '#1c6b6b';
const GOLD = '#C98A12';

const SERIF = `'Noto Serif Tamil', ${DISPLAY_FONT}`;

// Fixed sample question (not drawn from the question bank).
const QUESTION = 'இந்திய அரசியலமைப்புச் சட்டம் எந்த ஆண்டு நடைமுறைக்கு வந்தது?';
const OPTIONS = [
  { key: 'அ', text: '1947' },
  { key: 'ஆ', text: '1949' },
  { key: 'இ', text: '1950' },
  { key: 'ஈ', text: '1952' },
];
const CORRECT = 2;
const EXPLANATION =
  'அரசியலமைப்பு 1949 நவ. 26-ல் ஏற்கப்பட்டது; 1950 ஜன. 26 முதல் நடைமுறைக்கு வந்தது. அதனால்தான் அந்நாள் குடியரசு நாள்.';

export default function TestYourAbilityPage() {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <main style={{ minHeight: '100dvh', background: PAPER, color: INK, ['--color-paper' as string]: PAPER } as React.CSSProperties}>
      <style>{`
        .ty-opt:not(:disabled):hover { border-color: ${TEAL}; background: #f3f7f1; }
      `}</style>

      <div style={{ position: 'relative', height: 430, maxWidth: 460, margin: '0 auto', overflow: 'hidden' }}>
        <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: HERO_ART_SVG }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, padding: '16px 22px 0' }}>
          <div style={{ display: 'inline-block', background: '#fefefe', borderRadius: 8, padding: '4px 10px' }}>
            <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ height: 38, width: 'auto', display: 'block' }} />
          </div>
          <p style={{ color: '#FFE9A8', fontSize: 13, fontWeight: 500, margin: '22px 0 6px', textShadow: '0 1px 6px rgba(0,0,0,.35)' }}>
            அன்புடன் வரவேற்கிறோம்!
          </p>
          <h1 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 30, lineHeight: 1.45, color: '#fff', margin: 0, textShadow: '0 2px 12px rgba(5,30,40,.55)' }}>
            உங்கள் தேர்வுக்கு<br />நீங்கள் தயாரா?
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: '10px auto 0', padding: '0 20px 36px' }}>
        <p style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 17, margin: '0 0 14px', textAlign: 'center', color: TEAL }}>
          சரியான விடையைத் தேர்வு செய்யுங்கள்
        </p>

        <div style={{ background: '#fff', borderRadius: 16, padding: '18px 16px 14px', boxShadow: '0 10px 30px -12px rgba(15,47,51,.35)', border: '1px solid #eadfc4' }}>
          <div style={{ fontSize: 12.5, color: GOLD, fontWeight: 700, marginBottom: 8 }}>கேள்வி 1 · TNPSC குரூப்-4 · பொது அறிவு</div>
          <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 19, lineHeight: 1.65, margin: '0 0 14px' }}>{QUESTION}</p>

          {OPTIONS.map((o, i) => {
            const isRight = answered && i === CORRECT;
            const isWrong = answered && i === picked && i !== CORRECT;
            return (
              <button
                key={o.key}
                type="button"
                className="ty-opt"
                disabled={answered}
                onClick={() => setPicked(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 50, textAlign: 'left',
                  background: isRight ? '#E4F4E2' : isWrong ? '#FCE9E6' : PAPER,
                  border: `1.5px solid ${isRight ? '#2e8b3d' : isWrong ? '#c0392b' : '#e6dab8'}`,
                  borderRadius: 12, padding: '12px 14px', marginBottom: 10,
                  fontSize: 17, fontWeight: 500, color: INK, cursor: answered ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none',
                    fontSize: 12, fontWeight: 700,
                    background: isRight ? '#2e8b3d' : isWrong ? '#c0392b' : '#fff',
                    color: isRight || isWrong ? '#fff' : TEAL,
                    border: `1.5px solid ${isRight ? '#2e8b3d' : isWrong ? '#c0392b' : TEAL}`,
                  }}
                >
                  {o.key}
                </span>
                {o.text}
              </button>
            );
          })}

          {!answered && <p style={{ fontSize: 13, color: '#6f7f7a', textAlign: 'center', margin: '2px 0 0' }}>ஒன்றைத் தொடுங்கள்</p>}
          {answered && (
            <p role="status" style={{ fontSize: 14.5, lineHeight: 1.75, background: '#FFF6DA', borderRadius: 10, padding: '10px 12px', margin: '4px 0 0' }}>
              <b>{picked === CORRECT ? 'சரி!' : 'இல்லை, சரியான விடை 1950.'}</b> {EXPLANATION}
            </p>
          )}
        </div>

        {answered && (
          <div style={{ marginTop: 22 }}>
            <a
              href="/ask-ponna?guestDiagnostic=1"
              style={{ display: 'block', textAlign: 'center', background: INK, color: '#FFE9A8', textDecoration: 'none', fontWeight: 700, fontSize: 17, padding: 16, borderRadius: 14 }}
            >
              தொடருங்கள் →
            </a>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <a href="/?skipWelcome=1" style={{ fontSize: 13.5, color: '#2851A3', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            இப்போதைக்கு வேண்டாம், Home-க்கு செல்ல
          </a>
        </div>
        {/* Nothing may appear below the "Home-க்கு செல்ல" link (explicit
            request); the global legal footer is hidden on this route. */}
      </div>
    </main>
  );
}
