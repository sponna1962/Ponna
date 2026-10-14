'use client';

// Mind Gym · Word Memory: 6 words are shown, then hidden; the student picks
// the ones they saw from a list of 12 (the 6 seen + 6 new ones).

import { useEffect, useRef, useState } from 'react';
import { GameShell, mgCard, mgPrimaryBtn } from '../../../components/MindGym';
import { MG_BAD, MG_GOLD, MG_GOOD, MG_INK, readBest, saveBest, shuffle } from '../../../lib/mind-gym';

const WORDS = [
  'மரம்', 'நதி', 'மலை', 'கடல்', 'பறவை', 'யானை', 'குதிரை', 'மான்', 'புலி', 'சிங்கம்',
  'வாழை', 'மாம்பழம்', 'பலா', 'தேங்காய்', 'கீரை', 'அரிசி', 'பருப்பு', 'உப்பு', 'சர்க்கரை', 'பால்',
  'தயிர்', 'வெண்ணெய்', 'நெய்', 'பள்ளி', 'புத்தகம்', 'பேனா', 'பென்சில்', 'மேசை', 'நாற்காலி', 'கடிகாரம்',
  'விளக்கு', 'கதவு', 'ஜன்னல்', 'சாலை', 'பேருந்து', 'ரயில்', 'படகு', 'விமானம்', 'மிதிவண்டி', 'குடை',
  'வானம்', 'நிலா', 'சூரியன்', 'நட்சத்திரம்', 'மேகம்', 'மழை', 'காற்று', 'நெருப்பு', 'தண்ணீர்', 'மண்',
  'பூ', 'இலை', 'வேர்', 'விதை', 'தோட்டம்', 'வயல்', 'கிணறு', 'குளம்', 'பாலம்', 'கோயில்',
  'நூலகம்', 'மருத்துவமனை', 'கடை', 'சந்தை', 'வீடு', 'தெரு', 'ஊர்', 'நகரம்', 'கிராமம்', 'தோப்பு',
  'தட்டு', 'கரண்டி', 'பானை', 'சட்டி', 'குவளை', 'பாய்', 'தலையணை', 'போர்வை', 'சாவி', 'பூட்டு',
  'செருப்பு', 'சட்டை', 'வேட்டி', 'புடவை', 'தொப்பி', 'கண்ணாடி', 'பை', 'பணம்', 'நாணயம்', 'கடிதம்',
  'நாளிதழ்', 'வானொலி', 'தொலைக்காட்சி', 'கணினி', 'தொலைபேசி', 'ஓவியம்', 'பாட்டு', 'நடனம்', 'விளையாட்டு', 'பந்து',
  'மீன்', 'ஆடு', 'மாடு', 'நாய்', 'பூனை', 'கோழி', 'வாத்து', 'தேனீ', 'எறும்பு', 'வண்ணத்துப்பூச்சி',
];
const SHOWN = 6;
const SHOW_MS = 8000;
const BEST_KEY = 'ponna_mg_best_words';

export default function WordMemoryPage() {
  const [phase, setPhase] = useState<'intro' | 'show' | 'pick' | 'over'>('intro');
  const [seen, setSeen] = useState<string[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setBest(readBest(BEST_KEY)); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function begin() {
    if (timer.current) clearTimeout(timer.current);
    const mix = shuffle(WORDS);
    const shown = mix.slice(0, SHOWN);
    const decoys = mix.slice(SHOWN, SHOWN * 2);
    setSeen(shown); setChoices(shuffle([...shown, ...decoys])); setTicked(new Set()); setNewBest(false);
    setPhase('show');
    timer.current = setTimeout(() => setPhase('pick'), SHOW_MS);
  }

  function toggle(w: string) {
    const next = new Set(ticked);
    if (next.has(w)) next.delete(w); else next.add(w);
    setTicked(next);
  }

  const correct = Array.from(ticked).filter((w) => seen.includes(w)).length;
  const wrong = ticked.size - correct;
  const score = Math.max(0, correct - wrong);

  function finish() {
    if (score > best) { setBest(score); saveBest(BEST_KEY, score); setNewBest(true); }
    setPhase('over');
  }

  const chip = (w: string): React.CSSProperties => {
    const on = ticked.has(w);
    const reveal = phase === 'over';
    const isSeen = seen.includes(w);
    const border = reveal ? (isSeen ? MG_GOOD : on ? MG_BAD : '#d9cfb0') : on ? MG_INK : '#d9cfb0';
    const bg = reveal ? (isSeen ? '#e6f4ea' : on ? '#fbe9e7' : '#fff') : on ? '#efe6cc' : '#fff';
    return { padding: '12px 8px', borderRadius: 10, border: `2px solid ${border}`, background: bg, color: MG_INK, fontSize: 16.5, fontWeight: 600, cursor: reveal ? 'default' : 'pointer', fontFamily: 'inherit' };
  };

  return (
    <GameShell title="Word Memory" subtitle="வார்த்தைகளைப் பார்த்து நினைவில் வைத்துக்கொள்ளுங்கள்.">
      {phase === 'intro' && (
        <div style={mgCard}>
          <p style={{ margin: '0 0 16px', fontSize: 15.5 }}>{SHOWN} வார்த்தைகள் {SHOW_MS / 1000} வினாடிகள் தெரியும். மறைந்த பின், 12 வார்த்தைகளில் நீங்கள் பார்த்தவற்றை மட்டும் தேர்ந்தெடுங்கள்.</p>
          {best > 0 && <p style={{ margin: '0 0 14px', fontSize: 15, color: MG_GOLD, fontWeight: 700 }}>உங்கள் சிறந்த மதிப்பெண்: {best} / {SHOWN}</p>}
          <button style={mgPrimaryBtn} onClick={begin}>தொடங்கு</button>
        </div>
      )}

      {phase === 'show' && (
        <div style={mgCard} aria-live="polite">
          <p style={{ margin: 0, fontSize: 14, color: '#4b5d5f' }}>இந்த வார்த்தைகளை நினைவில் வைத்துக்கொள்ளுங்கள்</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, margin: '16px 0' }}>
            {seen.map((w) => <div key={w} style={{ padding: '14px 8px', borderRadius: 10, background: '#efe6cc', fontSize: 20, fontWeight: 700, color: MG_INK }}>{w}</div>)}
          </div>
          <div style={{ height: 6, background: '#efe6cc', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: MG_GOLD, animation: `mgshrink ${SHOW_MS}ms linear forwards` }} />
          </div>
        </div>
      )}

      {(phase === 'pick' || phase === 'over') && (
        <div style={mgCard}>
          <p style={{ margin: '0 0 12px', fontSize: 15 }}>
            {phase === 'pick' ? 'நீங்கள் பார்த்த வார்த்தைகளைத் தொடுங்கள்' : 'பச்சை நிறம் = நீங்கள் பார்த்த வார்த்தைகள்'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {choices.map((w) => (
              <button key={w} type="button" style={chip(w)} onClick={() => phase === 'pick' && toggle(w)} disabled={phase === 'over'}>{w}</button>
            ))}
          </div>
          {phase === 'pick' && (
            <button style={{ ...mgPrimaryBtn, marginTop: 16, opacity: ticked.size === 0 ? 0.45 : 1 }} disabled={ticked.size === 0} onClick={finish}>சரிபார் ({ticked.size} தேர்வு)</button>
          )}
          {phase === 'over' && (
            <>
              <p style={{ margin: '16px 0 4px', fontSize: 18, fontWeight: 700 }}>{correct} / {SHOWN} சரியாக நினைவில் வைத்தீர்கள்{wrong > 0 ? `; ${wrong} தவறான தேர்வு` : ''}</p>
              <p style={{ margin: '0 0 8px', fontSize: 14.5, color: '#4b5d5f' }}>மதிப்பெண்: {score} / {SHOWN}</p>
              {newBest && <p style={{ margin: '0 0 8px', color: MG_GOLD, fontWeight: 700 }}>உங்கள் புதிய சிறந்த மதிப்பெண்! 🎉</p>}
              <button style={{ ...mgPrimaryBtn, marginTop: 8 }} onClick={begin}>மீண்டும் விளையாடு</button>
            </>
          )}
        </div>
      )}
    </GameShell>
  );
}
