'use client';

// Mind Gym hub (Oct 2026): six small memory / speed / reasoning practices.
// Everything runs in the browser, no sign-in. Each card shows only the
// student's OWN best result (kept in this browser), never anyone else's.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DISPLAY_FONT } from '../../lib/brand-theme';
import { MindGymHeader } from '../../components/MindGym';
import { MG_GOLD, MG_INK, MG_PAPER, MG_TEAL, readBest } from '../../lib/mind-gym';

const SERIF = `'Noto Serif Tamil', ${DISPLAY_FONT}`;

const GAMES = [
  { href: '/mind-gym/memory-numbers', title: 'Memory Numbers', body: 'எண்ணை நினைவில் வைத்து, மறைந்த பின் தட்டச்சு செய்யுங்கள்.', key: 'ponna_memory_best', unit: 'இலக்கங்கள்', total: 0 },
  { href: '/mind-gym/speed-math', title: 'Speed Math', body: '10 வினாடிகளுக்குள் விடை சொல்லுங்கள்.', key: 'ponna_mg_best_math', unit: '/ 10', total: 10 },
  { href: '/mind-gym/number-series', title: 'Number Series', body: 'வரிசையில் அடுத்த எண் எது?', key: 'ponna_mg_best_series', unit: '/ 8', total: 8 },
  { href: '/mind-gym/word-memory', title: 'Word Memory', body: 'வார்த்தைகளைப் பார்த்து நினைவில் வைத்துக்கொள்ளுங்கள்.', key: 'ponna_mg_best_words', unit: '/ 6', total: 6 },
  { href: '/mind-gym/odd-one-out', title: 'Odd One Out', body: 'நான்கில் வேறுபடும் ஒன்றைக் கண்டுபிடியுங்கள்.', key: 'ponna_mg_best_odd', unit: '/ 8', total: 8 },
  { href: '/mind-gym/code-breaker', title: 'Code Breaker', body: 'குறியீட்டின் விதியைக் கண்டுபிடியுங்கள்.', key: 'ponna_mg_best_code', unit: '/ 8', total: 8 },
];

export default function MindGymPage() {
  const [bests, setBests] = useState<Record<string, number>>({});
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const g of GAMES) next[g.key] = readBest(g.key);
    setBests(next);
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: MG_PAPER, color: MG_INK, fontFamily: SERIF }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <MindGymHeader />
      </div>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 40px' }}>
        <p style={{ fontSize: 14.5, color: '#4b5d5f', margin: '0 0 18px' }}>நினைவாற்றல், வேகம், சிந்தனைக்கான இலவசப் பயிற்சிகள். பதிவு தேவையில்லை.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {GAMES.map((g) => {
            const b = bests[g.key] ?? 0;
            return (
              <Link key={g.href} href={g.href} style={{ textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid #e7dcc0', borderRadius: 14, padding: '14px 12px', boxShadow: '0 2px 8px rgba(15,47,51,0.05)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 800 }}>{g.title}</span>
                <span style={{ fontSize: 13, color: '#4b5d5f', lineHeight: 1.5, flex: 1 }}>{g.body}</span>
                <span style={{ fontSize: 12.5, color: MG_GOLD, fontWeight: 700 }}>
                  {b > 0 ? `உங்கள் சிறந்தது: ${b} ${g.unit}` : 'இன்னும் விளையாடவில்லை'}
                </span>
              </Link>
            );
          })}
        </div>
        <p style={{ fontSize: 12.5, color: '#6b7a7c', marginTop: 18, lineHeight: 1.6 }}>
          இவை நினைவாற்றல் மற்றும் வேகத்துக்கான பயிற்சிகள். உங்கள் சிறந்த நிலை உங்கள் போனில் மட்டுமே சேமிக்கப்படும்.
        </p>
      </div>
    </main>
  );
}
