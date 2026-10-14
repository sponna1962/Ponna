'use client';

import { ChoiceGame, type ChoiceQuestion } from '../../../components/MindGym';
import { buildOptions, pick, randInt } from '../../../lib/mind-gym';

function makeQuestion(): ChoiceQuestion {
  const kind = pick(['add', 'sub', 'mul', 'square', 'grow', 'alt'] as const);
  let terms: number[] = [];
  let answer = 0;
  let explanation = '';
  let step = 1;

  if (kind === 'add') {
    const a = randInt(1, 20); const d = randInt(2, 9);
    terms = [0, 1, 2, 3, 4].map((i) => a + d * i); answer = a + d * 5; step = d;
    explanation = `ஒவ்வொரு எண்ணும் ${d} கூடுகிறது. எனவே ${terms[4]} + ${d} = ${answer}.`;
  } else if (kind === 'sub') {
    const d = randInt(3, 9); const a = randInt(60, 100);
    terms = [0, 1, 2, 3, 4].map((i) => a - d * i); answer = a - d * 5; step = d;
    explanation = `ஒவ்வொரு எண்ணும் ${d} குறைகிறது. எனவே ${terms[4]} − ${d} = ${answer}.`;
  } else if (kind === 'mul') {
    const r = pick([2, 3]); const a = randInt(1, 3);
    terms = [0, 1, 2, 3, 4].map((i) => a * r ** i); answer = a * r ** 5; step = answer / r;
    explanation = `ஒவ்வொரு எண்ணும் ${r} மடங்கு ஆகிறது. எனவே ${terms[4]} × ${r} = ${answer}.`;
  } else if (kind === 'square') {
    const k = randInt(1, 6);
    terms = [0, 1, 2, 3, 4].map((i) => (k + i) ** 2); answer = (k + 5) ** 2; step = 2 * (k + 5) - 1;
    explanation = `இவை வர்க்க எண்கள்: ${[0, 1, 2, 3, 4].map((i) => `${k + i}²`).join(', ')}. அடுத்தது ${k + 5}² = ${answer}.`;
  } else if (kind === 'grow') {
    const a = randInt(1, 10); const d0 = randInt(1, 3);
    terms = [a]; for (let i = 0; i < 4; i++) terms.push(terms[i] + d0 + i);
    answer = terms[4] + d0 + 4; step = d0 + 4;
    explanation = `வித்தியாசங்கள் ${d0}, ${d0 + 1}, ${d0 + 2}, ${d0 + 3} என ஒவ்வொரு முறையும் 1 கூடுகின்றன. அடுத்த வித்தியாசம் ${d0 + 4}, எனவே ${terms[4]} + ${d0 + 4} = ${answer}.`;
  } else {
    const a = randInt(1, 15); const x = randInt(2, 9); let y = randInt(2, 9);
    if (y === x) y = x === 9 ? 2 : x + 1;
    terms = [a]; for (let i = 0; i < 4; i++) terms.push(terms[i] + (i % 2 === 0 ? x : y));
    answer = terms[4] + x; step = x;
    explanation = `மாறி மாறி +${x}, +${y} என்று கூடுகிறது. அடுத்தது +${x}, எனவே ${terms[4]} + ${x} = ${answer}.`;
  }

  const wrong = [answer + 1, answer - 1, answer + step, answer - step, answer + 2, answer - 2]
    .filter((n) => n > 0).map(String);
  const { options, answerIndex } = buildOptions(String(answer), wrong, () => String(answer + randInt(3, 12)));
  return { prompt: `${terms.join(', ')}, ?`, options, answerIndex, explanation };
}

export default function NumberSeriesPage() {
  return (
    <ChoiceGame
      title="Number Series"
      subtitle="வரிசையில் அடுத்த எண் எது என்று கண்டுபிடியுங்கள்."
      intro="8 கேள்விகள். ஒவ்வொரு எண் வரிசையிலும் ஒரு விதி இருக்கும். அதைக் கண்டுபிடித்து அடுத்த எண்ணைத் தேர்ந்தெடுங்கள்."
      bestKey="ponna_mg_best_series"
      count={8}
      makeQuestion={makeQuestion}
      bigPrompt
    />
  );
}
