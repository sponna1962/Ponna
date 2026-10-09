// Group 4 (Notification No. 11/2026, Advertisement No. 747) knowledge search.
//
// Backs Ask Ponna's `search_group4_notification` tool. No AI is involved
// here: it is plain keyword scoring over a prebuilt JSON of (a) the PONNA
// guide's sections and (b) the official notification PDF's text, so a
// lookup costs nothing beyond the one chat turn that is already happening.
// Only the few most relevant passages are returned (and only the most
// relevant LINES of a long table), which keeps what is sent to the model
// small. Rebuild g4-knowledge.json with backend/scripts/build-g4-knowledge.py
// whenever the guide content changes.

import knowledge from './g4-knowledge.json';

type Chunk = { id: string; kind: 'guide' | 'pdf'; title: string; kw?: string; text: string; url: string };

const SITE = 'https://www.ponna.in';
const CHUNKS = knowledge as Chunk[];

// Tamil (and common abbreviation) -> English search terms, because the
// official notification is written in English. Substring match on the query.
const SYNONYMS: [string, string][] = [
  ['வயது', 'age limit age concession'], ['வயசு', 'age limit'], ['கட்டண', 'fee examination fee exemption'], ['ஃபீஸ்', 'fee'], ['பீஸ்', 'fee'],
  ['சம்பள', 'pay level salary'], ['ஊதிய', 'pay level salary'], ['காலியிட', 'vacancies posts'], ['பணியிட', 'vacancies posts'], ['தேதி', 'date dates'],
  ['கடைசி நாள்', 'last date closing'], ['பாடத்திட்ட', 'syllabus'], ['சிலபஸ்', 'syllabus'], ['விண்ணப்ப', 'application apply online'],
  ['சான்றிதழ்', 'certificate certificates'], ['இடஒதுக்கீடு', 'reservation'], ['இட ஒதுக்கீடு', 'reservation'], ['முன்னாள் படை', 'ex-servicemen'],
  ['விதவை', 'destitute widow'], ['மாற்றுத்திறன்', 'persons with benchmark disability pbd'], ['தேர்வு மையம்', 'examination centre centres'],
  ['தேர்வு முறை', 'scheme of examination plan of examination'], ['கல்வித் தகுதி', 'educational qualification'], ['தகுதி', 'eligibility qualification'],
  ['தமிழ் வழி', 'person studied in tamil medium pstm'], ['கலந்தாய்வு', 'counselling'], ['ஹால் டிக்கெட்', 'hall ticket memorandum of admission'],
  ['விடைத்தாள்', 'omr answer sheet'], ['ஓஎம்ஆர்', 'omr'], ['ஒருமுறை பதிவு', 'one time registration otr'], ['விளையாட்டு', 'sports sportsperson'],
  ['திருநங்கை', 'transgender'], ['பெண்', 'women'], ['மருத்துவ', 'medical standards'], ['கண் பார்வை', 'vision'], ['வினாத்தாள்', 'question paper'],
  ['தவறான விடை', 'negative marking penalty'], ['மதிப்பெண்', 'marks'], ['தரவரிசை', 'ranking rank'], ['தட்டச்சு', 'typewriting typist'],
  ['கிராம நிர்வாக', 'village administrative officer vao'], ['வனக் காவலர்', 'forest guard forest watcher'], ['வனக்காவலர்', 'forest guard forest watcher'],
  ['தடை செய்யப்பட்ட', 'banned items'], ['கால்குலேட்டர்', 'calculator banned items'], ['மொபைல்', 'mobile phone banned items'], ['எழுத்தர்', 'clerk'],
  ['கேள்வி', 'questions scheme of examination'], ['நேரம்', 'duration hours'], ['எத்தனை', 'number'], ['கட் ஆஃப்', 'minimum qualifying marks ranking'],
  ['வழக்கு', 'criminal cases litigation'], ['தண்டனை', 'penalty debarment'], ['உதவியாளர்', 'assistant'],
];
const ABBREV: Record<string, string> = {
  vao: 'village administrative officer', pbd: 'persons with benchmark disability', pwbd: 'persons with benchmark disability',
  pstm: 'person studied in tamil medium', otr: 'one time registration', omr: 'omr answer sheet', ja: 'junior assistant', sc: 'scheduled castes',
  st: 'scheduled tribes', mbc: 'most backward classes', bcm: 'backward class muslims', bc: 'backward classes', obc: 'backward classes', oc: 'others',
  dw: 'destitute widow', exsm: 'ex-servicemen', 'ex-service': 'ex-servicemen', tnpsc: 'tnpsc', rs: 'fee', questions: 'scheme of examination objective type 200 questions', duration: 'duration hours scheme of examination', pattern: 'scheme of examination', marks: 'marks scheme of examination', cutoff: 'minimum qualifying marks ranking', 'cut-off': 'minimum qualifying marks ranking',
};
const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'is', 'are', 'what', 'how', 'when', 'where', 'which', 'who', 'does', 'do', 'can', 'will', 'be', 'by', 'with', 'as', 'at', 'from', 'this', 'that', 'it', 'me', 'my', 'about', 'tell', 'group', 'tnpsc', '4', 'iv', 'many', 'much', 'number', 'there', 'should', 'need', 'give', 'please']);

// light English stemming so 'exam' / 'examination', 'question' / 'questions', 'post' / 'posts' match
const norm = (t: string): string => {
  if (!/^[a-z]+$/.test(t)) return t;
  if (t.startsWith('examin')) return 'exam';
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
};
const tokenize = (s: string): string[] => (s.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 || /\d/.test(t)).map(norm);

type Indexed = { chunk: Chunk; tf: Map<string, number>; titleTokens: Set<string>; len: number };
let INDEX: Indexed[] | null = null;
let DF = new Map<string, number>();

function build(): Indexed[] {
  const idx = CHUNKS.map((chunk) => {
    const toks = tokenize(chunk.text);
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk, tf, titleTokens: new Set(tokenize(chunk.title + ' ' + (chunk.kw ?? ''))), len: toks.length };
  });
  DF = new Map();
  for (const it of idx) for (const t of it.tf.keys()) DF.set(t, (DF.get(t) ?? 0) + 1);
  return idx;
}

function expandQuery(q: string): string[] {
  let extra = '';
  const lower = q.toLowerCase();
  for (const [ta, en] of SYNONYMS) if (q.includes(ta)) extra += ' ' + en;
  const base = tokenize(lower);
  for (const t of base) if (ABBREV[t]) extra += ' ' + ABBREV[t];
  const terms = [...base, ...tokenize(extra)].filter((t) => !STOP.has(t));
  return Array.from(new Set(terms));
}

// Keep the first lines (context) plus the lines that best match the query,
// in original order, within a character budget — so a 14,000-character
// qualification table sends just the rows the student asked about.
function selectLines(text: string, terms: string[], budget: number): string {
  if (text.length <= budget) return text;
  const lines = text.split('\n');
  const scored = lines.map((line, i) => {
    const lt = new Set(tokenize(line));
    let s = 0;
    for (const t of terms) if (lt.has(t)) s += 1 + Math.min(2, t.length / 6);
    return { i, line, s };
  });
  const keep = new Set<number>();
  let used = 0;
  const add = (i: number) => {
    if (keep.has(i) || i < 0 || i >= lines.length) return true;
    if (used + lines[i].length + 1 > budget) return false;
    keep.add(i);
    used += lines[i].length + 1;
    return true;
  };
  for (let i = 0; i < Math.min(2, lines.length); i++) add(i);
  for (const l of [...scored].filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i)) {
    if (!add(l.i)) break;
  }
  const out: string[] = [];
  let prev = -1;
  for (const i of Array.from(keep).sort((a, b) => a - b)) {
    if (prev !== -1 && i !== prev + 1) out.push('…');
    out.push(lines[i]);
    prev = i;
  }
  return out.join('\n') + '\n[… the rest of this section is at the link]';
}

export type G4SearchResult =
  | { found: false; message: string; sections: { title: string; link: string }[] }
  | {
      found: true;
      source: string;
      guidePage: string;
      results: { source: string; title: string; link: string; text: string }[];
      note: string;
    };

export function searchGroup4Notification(query: string): G4SearchResult {
  if (!INDEX) INDEX = build();
  const terms = expandQuery(query || '');
  // "How do I apply?" style questions -> the consolidated step-by-step walkthrough ranks first
  const howToApply = terms.includes('apply') && /\bhow\b|steps?|procedure|process|எப்படி|படி|முறை|நடைமுறை|வழிமுறை/i.test(query || '');
  const N = INDEX.length;
  const scored = INDEX.map((it) => {
    let s = 0;
    for (const t of terms) {
      const tf = it.tf.get(t);
      if (tf) s += Math.log(1 + N / (DF.get(t) ?? 1)) * (1 + Math.log(tf));
      if (it.titleTokens.has(t)) s += 4;
    }
    s = s / Math.pow(Math.max(it.len, 50), 0.15); // mild length normalisation
    if (it.chunk.kind === 'guide') s *= 1.25; // curated, row-structured text first
    if (howToApply && it.chunk.id === 'guide:howto') s *= 3;
    return { it, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!terms.length || scored.length === 0) {
    return {
      found: false,
      message: 'No passage in the Group 4 notification text matched this query.',
      sections: CHUNKS.filter((c) => c.kind === 'guide').map((c) => ({ title: c.title, link: SITE + c.url })),
    };
  }

  // too weak a match (e.g. an off-topic question) -> treat as not found
  const nTerms = terms.length;
  const best = scored[0];
  const matched = terms.filter((t) => best.it.tf.has(t) || best.it.titleTokens.has(t)).length;
  if (matched < Math.min(2, nTerms) || best.s < 1.5) {
    return {
      found: false,
      message: 'No passage in the Group 4 notification text matched this query closely. Do not guess; point the student to the guide.',
      sections: CHUNKS.filter((c) => c.kind === 'guide').map((c) => ({ title: c.title, link: SITE + c.url })),
    };
  }

  // top 3 passages; a 4th only if it is nearly as relevant as the best one
  const top = scored.slice(0, 3);
  if (scored[3] && scored[3].s > scored[0].s * 0.8) top.push(scored[3]);
  const budgetEach = top.length >= 4 ? 2300 : top.length === 3 ? 3000 : 4500;
  const results = top.map(({ it }) => ({
    source: it.chunk.kind === 'guide' ? 'PONNA guide section (compiled from the official notification)' : it.chunk.title,
    title: it.chunk.title,
    link: SITE + it.chunk.url,
    text: selectLines(it.chunk.text, terms, it.chunk.id === 'guide:age' || it.chunk.id === 'guide:howto' ? 7000 : budgetEach),
  }));
  return {
    found: true,
    source: 'TNPSC Notification No. 11/2026 (Advertisement No. 747), Combined Civil Services Examination-IV (Group IV Services)',
    guidePage: `${SITE}/tnpsc-group-4/notification-2026`,
    results,
    note: 'Answer ONLY from these passages. If the exact detail is not in them, say so and point to the guide link — never guess or fill from memory.',
  };
}
