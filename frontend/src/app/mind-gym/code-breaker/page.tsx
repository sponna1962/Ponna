'use client';

import { ChoiceGame, type ChoiceQuestion } from '../../../components/MindGym';
import { buildOptions, pick, randInt, shuffle } from '../../../lib/mind-gym';

const WORDS = ['CAT', 'DOG', 'BED', 'FAN', 'PEN', 'MAP', 'SUN', 'BOX', 'HEN', 'JAR', 'KEY', 'LAB', 'NET', 'OWL', 'RAT', 'TEA', 'BAG', 'CUP', 'LID', 'FOX'];
const A = 'A'.charCodeAt(0);
const shift = (w: string, n: number) => w.split('').map((c) => String.fromCharCode(((c.charCodeAt(0) - A + n + 26) % 26) + A)).join('');
const digits = (w: string) => w.split('').map((c) => c.charCodeAt(0) - A + 1).join('');
const total = (w: string) => w.split('').reduce((s, c) => s + (c.charCodeAt(0) - A + 1), 0);

function makeQuestion(): ChoiceQuestion {
  const kind = pick(['shift', 'sum', 'digits'] as const);
  const [w1, w2] = shuffle(WORDS).slice(0, 2);

  if (kind === 'shift') {
    const n = pick([1, 2, 3, -1, -2]);
    const answer = shift(w2, n);
    const wrong = [shift(w2, n + 1), shift(w2, n - 1), shift(w2, -n), w2.split('').reverse().join('')];
    const { options, answerIndex } = buildOptions(answer, wrong, () => shift(w2, randInt(4, 9)));
    const dir = n > 0 ? `${n} இடம் பின்னால்` : `${-n} இடம் முன்னால்`;
    return {
      prompt: `ஒரு குறியீட்டு முறையில் ${w1} என்பது ${shift(w1, n)} என எழுதப்படுகிறது. அதே முறையில் ${w2} என்பதை எவ்வாறு எழுதுவது?`,
      options, answerIndex,
      explanation: `ஒவ்வோர் எழுத்தும் அகரவரிசையில் ${dir} உள்ள எழுத்தாக மாறுகிறது. ${w2} → ${answer}.`,
    };
  }
  if (kind === 'sum') {
    const answer = total(w1);
    const { options, answerIndex } = buildOptions(String(answer), [answer + 1, answer - 1, answer + 2, answer - 2, answer + 10].map(String), () => String(answer + randInt(3, 9)));
    return {
      prompt: `A = 1, B = 2, C = 3 … என்றால், ${w1} என்ற சொல்லின் எழுத்து மதிப்புகளின் கூட்டுத்தொகை என்ன?`,
      options, answerIndex,
      explanation: `${w1.split('').map((c) => `${c} = ${c.charCodeAt(0) - A + 1}`).join(', ')}. கூட்டுத்தொகை = ${answer}.`,
    };
  }
  const answer = digits(w2);
  const wrong = [digits(w2.split('').reverse().join('')), String(Number(answer) + 1), String(Number(answer) - 1), total(w2).toString()];
  const { options, answerIndex } = buildOptions(answer, wrong, () => String(randInt(100, 2626)));
  return {
    prompt: `ஒரு குறியீட்டு முறையில் ${w1} என்பது ${digits(w1)} என எழுதப்படுகிறது. அதே முறையில் ${w2} என்பதை எவ்வாறு எழுதுவது?`,
    options, answerIndex,
    explanation: `ஒவ்வோர் எழுத்துக்கும் அகரவரிசை எண் (A = 1, B = 2 …) தரப்படுகிறது. ${w2} → ${answer}.`,
  };
}

export default function CodeBreakerPage() {
  return (
    <ChoiceGame
      title="Code Breaker"
      subtitle="குறியீட்டின் விதியைக் கண்டுபிடித்து விடையைத் தேர்ந்தெடுங்கள்."
      intro="8 கேள்விகள். எழுத்துகள் எவ்வாறு மாற்றப்படுகின்றன என்ற விதியைக் கண்டுபிடித்து, அதே விதியைப் பயன்படுத்துங்கள்."
      bestKey="ponna_mg_best_code"
      count={8}
      makeQuestion={makeQuestion}
    />
  );
}
