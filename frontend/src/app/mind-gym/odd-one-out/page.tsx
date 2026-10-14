'use client';

import { ChoiceGame, type ChoiceQuestion } from '../../../components/MindGym';
import { pick, randInt, shuffle } from '../../../lib/mind-gym';

// Each group holds only items that clearly belong to it. Pairs that overlap
// (for example birds are also animals) are never combined in one question.
const GROUPS: Record<string, string[]> = {
  'பழங்கள்': ['மாம்பழம்', 'வாழைப்பழம்', 'சாத்துக்குடி', 'திராட்சை', 'ஆப்பிள்', 'கொய்யா', 'பலாப்பழம்', 'அன்னாசி'],
  'காய்கறிகள்': ['கத்தரிக்காய்', 'வெண்டைக்காய்', 'முருங்கைக்காய்', 'பீர்க்கங்காய்', 'அவரைக்காய்', 'புடலங்காய்', 'கேரட்', 'முள்ளங்கி'],
  'விலங்குகள்': ['யானை', 'புலி', 'சிங்கம்', 'குதிரை', 'மான்', 'கரடி', 'ஓநாய்', 'ஒட்டகம்'],
  'பறவைகள்': ['மயில்', 'கிளி', 'காகம்', 'குயில்', 'புறா', 'கழுகு', 'ஆந்தை', 'குருவி'],
  'வாகனங்கள்': ['பேருந்து', 'ரயில்', 'படகு', 'விமானம்', 'மிதிவண்டி', 'லாரி', 'கார்', 'ஆட்டோ'],
  'ஆறுகள்': ['காவிரி', 'வைகை', 'தாமிரபரணி', 'பவானி', 'கங்கை', 'யமுனை', 'கோதாவரி', 'கிருஷ்ணா'],
  'நிறங்கள்': ['சிவப்பு', 'நீலம்', 'பச்சை', 'மஞ்சள்', 'கருப்பு', 'வெள்ளை', 'ஊதா', 'இளஞ்சிவப்பு'],
  'தமிழ் மாதங்கள்': ['சித்திரை', 'வைகாசி', 'ஆனி', 'ஆடி', 'ஆவணி', 'புரட்டாசி', 'ஐப்பசி', 'கார்த்திகை', 'மார்கழி', 'தை', 'மாசி', 'பங்குனி'],
  'தானியங்கள்': ['நெல்', 'கோதுமை', 'கம்பு', 'சோளம்', 'ராகி', 'உளுந்து', 'துவரை', 'கொள்ளு'],
  'உடல் உறுப்புகள்': ['கண்', 'காது', 'மூக்கு', 'கை', 'கால்', 'வாய்', 'இதயம்', 'நுரையீரல்'],
};
const NAMES = Object.keys(GROUPS);
const OVERLAPS: [string, string][] = [['விலங்குகள்', 'பறவைகள்']];
const overlaps = (a: string, b: string) => OVERLAPS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

function makeQuestion(): ChoiceQuestion {
  // Sometimes use numbers instead of words.
  if (Math.random() < 0.25) {
    const evens = Math.random() < 0.5;
    const same = new Set<number>();
    while (same.size < 3) same.add(evens ? randInt(1, 49) * 2 : randInt(0, 49) * 2 + 1);
    let odd = evens ? randInt(0, 49) * 2 + 1 : randInt(1, 49) * 2;
    while (same.has(odd)) odd = evens ? randInt(0, 49) * 2 + 1 : randInt(1, 49) * 2;
    const items = shuffle([...Array.from(same).map(String), String(odd)]);
    return {
      prompt: 'வேறுபடும் எண்ணைத் தேர்ந்தெடுக்கவும்',
      key: items.slice().sort().join('|'),
      options: items,
      answerIndex: items.indexOf(String(odd)),
      explanation: evens ? `மற்ற மூன்றும் இரட்டைப்படை எண்கள்; ${odd} ஒற்றைப்படை எண்.` : `மற்ற மூன்றும் ஒற்றைப்படை எண்கள்; ${odd} இரட்டைப்படை எண்.`,
    };
  }
  const main = pick(NAMES);
  let other = pick(NAMES);
  while (other === main || overlaps(main, other)) other = pick(NAMES);
  const three = shuffle(GROUPS[main]).slice(0, 3);
  const odd = pick(GROUPS[other]);
  const items = shuffle([...three, odd]);
  return {
    prompt: 'வேறுபடுவதைத் தேர்ந்தெடுக்கவும்',
    key: items.slice().sort().join('|'),
    options: items,
    answerIndex: items.indexOf(odd),
    explanation: `மற்ற மூன்றும் ${main}; ${odd} என்பது ${other}.`,
  };
}

export default function OddOneOutPage() {
  return (
    <ChoiceGame
      title="Odd One Out"
      subtitle="நான்கில் வேறுபடும் ஒன்றைக் கண்டுபிடியுங்கள்."
      intro="8 கேள்விகள். நான்கு தேர்வுகளில் மூன்று ஒரே வகை; ஒன்று மட்டும் வேறு. அதைத் தேர்ந்தெடுங்கள்."
      bestKey="ponna_mg_best_odd"
      count={8}
      makeQuestion={makeQuestion}
    />
  );
}
