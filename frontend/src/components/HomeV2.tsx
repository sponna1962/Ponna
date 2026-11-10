'use client';

// PONNA.in home page — Nov 2026 redesign (explicit request: visitors said the
// old page "looks like an AI website" and were afraid to pay). Decisions:
//  - no stock / generated photographs anywhere; the page leads with real,
//    checkable things: a working question from the question bank, today's
//    Current Affairs headlines, the product's own screens, the company's
//    registration details, the payment gateway and a phone number.
//  - a full top menu on computers; the shared StudentMenu drawer on phones.
//  - every number and claim is one the owner has confirmed. Nothing invented.
// All styles live in home-v2.css and are scoped under .pn2.

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { apiUrl } from '../lib/api-config';
import { rememberAfterLogin } from '../lib/after-login';
import { EXAMS, EXAM_GROUPS, examHref } from '../lib/exams';
import { SiteHeader, SiteFooter, Ico, PhonePath, PHONE_DISPLAY, useGroup4Days } from './site/SiteChrome';
import './home-v2.css';

type HomeProps = {
  menu?: ReactNode;
  onLogin?: () => void;
  onStart?: () => void;
  notice?: string;
  account?: ReactNode;
};


type OptionKey = 'A' | 'B' | 'C' | 'D';
const KEYS: OptionKey[] = ['A', 'B', 'C', 'D'];
const LABELS = ['அ', 'ஆ', 'இ', 'ஈ'];

type Question = { id: string | null; text: string; options: Record<OptionKey, string> };
type Result = { correctOption: OptionKey; explanation: string | null };

// Shown until a question arrives from the question bank, and kept if the
// request fails, so the card always works.
const FALLBACK_QUESTION: Question = {
  id: null,
  text: 'தமிழ்நாட்டின் மாநில மரம் எது?',
  options: { A: 'தென்னை மரம்', B: 'பனை மரம்', C: 'ஆல மரம்', D: 'மா மரம்' },
};
const FALLBACK_RESULT: Result = { correctOption: 'B', explanation: 'பனை மரம் தமிழ்நாட்டின் மாநில மரம்.' };

type NewsItem = { id: string; date: string; headline: string };


function fitsCard(q: { questionText: string; optionA: string; optionB: string; optionC: string; optionD: string }) {
  const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
  const plain = (s: string) => !!s && !/[<>]|https?:|\n/.test(s);
  return plain(q.questionText) && q.questionText.length <= 150 && opts.every((o) => plain(o) && o.length <= 42);
}

function splitHeadline(headline: string) {
  const m = headline.match(/^\[([^\]]+)\]\s*(.*)$/);
  return m ? { category: m[1], title: m[2] } : { category: 'நடப்பு நிகழ்வு', title: headline };
}

export default function HomeV2({ menu, onLogin, onStart, notice, account }: HomeProps = {}) {
  const days = useGroup4Days();
  const [question, setQuestion] = useState<Question>(FALLBACK_QUESTION);
  const [picked, setPicked] = useState<OptionKey | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);


  // One real question from the question bank (the public free-practice
  // endpoint). A different one each visit.
  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/guest-practice/questions?language=TA'))
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!alive || !Array.isArray(rows)) return;
        const q = rows.find(fitsCard);
        if (q) setQuestion({ id: q.id, text: q.questionText, options: { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD } });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The newest day's Current Affairs headlines.
  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/current-affairs?limit=12'))
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!alive || !Array.isArray(rows) || rows.length === 0) return;
        const day = String(rows[0].date).slice(0, 10);
        setNews(rows.filter((x) => String(x.date).slice(0, 10) === day).slice(0, 4));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function choose(key: OptionKey) {
    if (result || checking) return;
    setPicked(key);
    if (!question.id) { setResult(FALLBACK_RESULT); return; }
    setChecking(true);
    try {
      const res = await fetch(apiUrl('/guest-practice/answer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, selectedOption: key }),
      });
      if (!res.ok) throw new Error('check failed');
      const data = await res.json();
      setResult({ correctOption: data.correctOption, explanation: data.explanation ?? null });
    } catch {
      setPicked(null); // let the visitor tap again
    } finally {
      setChecking(false);
    }
  }

  // Pass button: a signed-in student goes straight to the Plans (payment)
  // page; a visitor is taken to sign-in first and returned to Plans after.
  const passClick = (e: MouseEvent) => {
    let signedIn = false;
    try { signedIn = !!localStorage.getItem('ponna_student_token'); } catch { /* private mode */ }
    if (signedIn || !onLogin) return;
    e.preventDefault();
    rememberAfterLogin('/plans');
    onLogin();
  };
  const startClick = onStart ? (e: MouseEvent) => { e.preventDefault(); onStart(); } : undefined;

  const explanation = result?.explanation
    ? (result.explanation.length > 280 ? `${result.explanation.slice(0, 277).trimEnd()}…` : result.explanation)
    : null;
  const newsDate = news[0]
    ? new Intl.DateTimeFormat('ta-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(news[0].date))
    : '';

  return (
    <main className="pn2">
      <SiteHeader menu={menu} account={account} onLogin={onLogin} onStart={onStart} />

      {notice && <div className="notice">{notice}</div>}

      <section className="hero">
        <div className="wrap">
          <div>
            <h1>TNPSC தேர்வுப் பயிற்சி <span>தமிழில், தினமும்.</span></h1>
            <p className="sub">கேள்விக்குப் பதில் சொன்ன உடனே சரியான விடை தெரியும். தவறிய கேள்விகளை மீண்டும் பயிற்சி செய்யலாம். கைப்பேசியிலும் கம்ப்யூட்டரிலும் படிக்கலாம்.</p>
            <div className="cta">
              <a className="btn btn-gold btn-lg" href="/quiz" onClick={startClick}>இலவசமாகப் பயிற்சி தொடங்குங்கள்</a>
            </div>
            <p className="fine">பதிவு செய்யாமலேயே முதலில் முயற்சி செய்து பார்க்கலாம்.</p>
            <div className="points">
              <div><Ico w={2}><path d="M4 5h16v14H4z" /><path d="M8 9h8M8 13h5" /></Ico>தமிழிலும் ஆங்கிலத்திலும்</div>
              <div><Ico w={2}><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></Ico>இணையம் இல்லாமலும்</div>
              <div><Ico w={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Ico>உங்கள் நேரத்தில்</div>
            </div>
          </div>

          <div className="q">
            <div className="q-top"><span>மாதிரிக் கேள்வி</span><span>கேள்வி வங்கியிலிருந்து</span></div>
            <div className="q-body">
              <div className="q-text">{question.text}</div>
              {KEYS.map((k, i) => {
                const right = !!result && result.correctOption === k;
                const wrong = !!result && picked === k && result.correctOption !== k;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`opt${right ? ' right' : ''}${wrong ? ' wrong' : ''}${checking && picked === k ? ' busy' : ''}`}
                    onClick={() => choose(k)}
                    disabled={!!result}
                  >
                    <i>{LABELS[i]}</i>{question.options[k]}
                  </button>
                );
              })}
              {!result && <div className="q-hint">{checking ? 'சரிபார்க்கிறோம்…' : 'ஒரு விடையைத் தொட்டுப் பாருங்கள்'}</div>}
              {result && (
                <div>
                  <div className="q-ans">
                    <b>சரியான விடை: {LABELS[KEYS.indexOf(result.correctOption)]}. {question.options[result.correctOption]}</b>
                    {explanation && <><br />{explanation}</>}
                  </div>
                  <a className="btn btn-navy q-more" href="/quiz" onClick={startClick}>இன்னும் கேள்விகள் பயிற்சி செய்ய</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-tint" id="exams">
        <div className="wrap">
          <div className="sec-h">
            <h2>TNPSC தேர்வுகள்</h2>
            <p>உங்கள் தேர்வைத் தேர்ந்தெடுங்கள். Group 4 பயிற்சி இப்போது தயார்; மற்ற தேர்வுகள் ஒவ்வொன்றாகத் திறக்கப்படும்.</p>
          </div>
          <div className="g4">
            <div className="g4-head">
              <div><h3>TNPSC Group 4</h3><p className="g4-posts">VAO, இளநிலை உதவியாளர், தட்டச்சர் உள்ளிட்ட பதவிகள்</p></div>
              <span className="tag">பயிற்சி தயார்</span>
            </div>
            <div className="facts">
              <div><strong className="hot">{days !== null ? `${days} நாட்கள்` : '10 ஜனவரி'}</strong><span>தேர்வுக்கு மீதம்</span></div>
              <div><strong>10.01.2027</strong><span>எழுத்துத் தேர்வு நாள்</span></div>
              <div><strong>6,574</strong><span>காலிப்பணியிடங்கள்</span></div>
            </div>
            <div className="row">
              <a className="btn btn-navy" href="/quiz" onClick={startClick}>Group 4 பயிற்சி தொடங்குங்கள்</a>
              <a className="btn btn-line" href="/exams/group-4">Group 4 பக்கம்</a>
              <a className="btn btn-line" href="/tnpsc-group-4/notification-2026">அறிவிப்பு முழு விவரம்</a>
            </div>
          </div>
          {EXAM_GROUPS.map((g) => {
            const list = EXAMS.filter((e) => e.group === g.id && !e.ready);
            if (list.length === 0) return null;
            return (
              <div key={g.id} className="exam-group">
                <h3 className="exam-group-h">{g.title}</h3>
                <div className="exam-grid">
                  {list.map((e) => (
                    <a key={e.slug} className="exam-tile" href={examHref(e)}>
                      <span className="tag soon">விரைவில்</span>
                      <b>{e.name}</b>
                      {e.posts && <small>{e.posts}</small>}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="soon-note">தேதிகள் TNPSC அறிவிப்பின் அடிப்படையில். மாற்றம் இருந்தால் tnpsc.gov.in-ல் சரிபார்க்கவும்.</p>
        </div>
      </section>

      {news.length > 0 && (
        <section className="sec" id="today">
          <div className="wrap today">
            <div className="side">
              <h2>நடப்பு நிகழ்வுகள்</h2>
              <span className="when">{newsDate}</span>
              <p>தேர்வுக்குப் பயன்படும் நிகழ்வுகள் மட்டும், தினமும் சுருக்கமாக.</p>
              <a className="btn btn-line" href="/current-affairs">அனைத்தையும் படிக்க</a>
            </div>
            <ul className="news">
              {news.map((item) => {
                const { category, title } = splitHeadline(item.headline);
                return (
                  <li key={item.id}>
                    <a href="/current-affairs"><span className="cat">{category}</span><span className="ttl">{title}</span></a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section className={`sec${news.length > 0 ? ' sec-tint' : ''}`} id="features">
        <div className="wrap">
          <div className="sec-h">
            <h2>PONNA.in-ல் உள்ள வசதிகள்</h2>
            <p>உங்கள் தேர்வுக்கான பயிற்சி, எல்லாத் தேர்வுக்கும் பொதுவான பகுதிகள், உங்கள் முன்னேற்றம்.</p>
          </div>
          <div className="feat">
            <div className="feat-col">
              <h3>தேர்வுப் பயிற்சி<small>நீங்கள் தேர்ந்தெடுக்கும் தேர்வுக்கு ஏற்ப</small></h3>
              <a href="/quiz" onClick={startClick}><Ico><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Ico><div><b>Practice</b><span>பாடவாரியாகக் கேள்விகள். உடனே விடை.</span></div></a>
              <a href="/live-exam"><Ico><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.500 2M9 2h6" /></Ico><div><b>Live Exam</b><span>தேர்வு போன்ற சூழலில், நேரக் கட்டுப்பாட்டுடன்.</span></div></a>
              <a href="/adaptive-mock"><Ico><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Ico><div><b>Adaptive Mock</b><span>உங்கள் நிலைக்கேற்ப மாறும் மாதிரித் தேர்வு.</span></div></a>
              <a href="/study-notes"><Ico><path d="M12 6c-2-1.500-5-2-8-2v14c3 0 6 .500 8 2 2-1.500 5-2 8-2V4c-3 0-6 .500-8 2zM12 6v14" /></Ico><div><b>Study Notes</b><span>ஒவ்வொரு தேர்வின் பாடத்திட்டப்படி குறிப்புகள்.</span></div></a>
            </div>
            <div className="feat-col">
              <h3>எல்லாத் தேர்வுக்கும் பொது<small>எந்தத் தேர்வு எழுதினாலும் பயன்படும்</small></h3>
              <a href="/current-affairs"><Ico><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h6v5H7zM16 8h1M16 12h1M7 16h10" /></Ico><div><b>Current Affairs</b><span>தேர்வுக்கான நடப்பு நிகழ்வுகள், தினமும் புதிது.</span></div></a>
              <a href="/daily-quiz"><Ico><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Ico><div><b>Daily Challenge</b><span>தினமும் Current Affairs, Brain Challenge.</span></div></a>
              <a href="/mind-gym"><Ico><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.500c.700.700 1 1.500 1 2.500h6c0-1 .300-1.800 1-2.500A6 6 0 0 0 12 3z" /></Ico><div><b>Mind Gym</b><span>நினைவாற்றல், வேகம், சிந்தனைப் பயிற்சிகள்.</span></div></a>
              <a href="/ask-ponna"><Ico><path d="M4 5h16v11H9l-5 4z" /><path d="M10 9.500a2 2 0 1 1 2.800 1.800c-.500.300-.800.700-.800 1.200M12 14.500v.100" /></Ico><div><b>Ask PONNA</b><span>தேர்வு பற்றிய சந்தேகங்களுக்கு விளக்கம்.</span></div></a>
            </div>
            <div className="feat-col">
              <h3>என் முன்னேற்றம்<small>எங்கே நிற்கிறீர்கள் என்று பாருங்கள்</small></h3>
              <a href="/dashboard"><Ico><path d="M3 20h18M5 16l4-5 4 3 6-8" /></Ico><div><b>Performance</b><span>உங்கள் மதிப்பெண், பாடவாரி முன்னேற்றம்.</span></div></a>
              <a href="/mistakes"><Ico><path d="M4 12a8 8 0 1 0 3-6.200M4 4v4h4" /></Ico><div><b>Review Mistakes</b><span>தவறிய கேள்விகளை மீண்டும் பயிற்சி செய்ய.</span></div></a>
              <a href="/cutoff-predictor"><Ico><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.500" /><path d="M12 12h.010" /></Ico><div><b>Cut-off Predictor</b><span>உங்கள் மதிப்பெண்ணை வைத்து கட்-ஆஃப் கணிப்பு.</span></div></a>
              <a href="/tnpsc-group-4/notification-2026"><Ico><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7" /></Ico><div><b>தேர்வு அறிவிப்புகள்</b><span>Group 4 அறிவிப்பு 2026: தகுதி, வயது, பாடத்திட்டம்.</span></div></a>
            </div>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="PONNA.in எண்கள்">
        <div className="wrap">
          <div><strong>1,50,000+</strong><span>கேள்விகளில் பயிற்சி</span></div>
          <div><strong>3,250+</strong><span>மாதாந்திர பயிற்சி</span></div>
          <div><strong>4,000+</strong><span>பயிற்சி முயற்சிகள்</span></div>
        </div>
      </section>

      <section className="sec" id="inside">
        <div className="wrap">
          <div className="sec-h">
            <h2>உள்ளே எப்படி இருக்கும்?</h2>
            <p>இவை PONNA.in தளத்தின் உண்மையான திரைகள்.</p>
          </div>
          <div className="screens">
            <div className="screen">
              <div className="frame"><img src="/home/screens/practice.jpg" alt="PONNA.in பயிற்சித் திரை" loading="lazy" /></div>
              <h3>கேள்விப் பயிற்சி</h3>
              <p>பதில் சொன்னவுடன் சரியான விடையும் விளக்கமும்.</p>
            </div>
            <div className="screen">
              <div className="frame"><img src="/home/screens/group4-guide.jpg" alt="PONNA.in Group 4 அறிவிப்பு வழிகாட்டி" loading="lazy" /></div>
              <h3>Group 4 அறிவிப்பு வழிகாட்டி</h3>
              <p>அறிவிப்பின் முழு விவரம், தமிழில்.</p>
            </div>
            <div className="screen">
              <div className="frame"><img src="/home/screens/mind-gym.jpg" alt="PONNA.in Mind Gym திரை" loading="lazy" /></div>
              <h3>Mind Gym</h3>
              <p>நினைவாற்றலுக்கும் வேகத்துக்கும் சிறு பயிற்சிகள்.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec sec-tint" id="trust">
        <div className="wrap">
          <div className="sec-h">
            <h2>PONNA.in-ஐ யார் நடத்துகிறார்கள்?</h2>
            <p>கட்டணம் செலுத்தும் முன் நீங்கள் தெரிந்துகொள்ள வேண்டியவை.</p>
          </div>
          <div className="trust">
            <div>
              <Ico w={1.7}><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6M9 11h.010M15 11h.010" /></Ico>
              <h3>பதிவு பெற்ற நிறுவனம்</h3>
              <p><b>ARLENA (OPC) Private Limited</b> என்ற, தமிழ்நாட்டில் பதிவு செய்யப்பட்ட நிறுவனத்தின் தளம். CIN: U63122TN2026OPC197880</p>
            </div>
            <div>
              <Ico w={1.7}><path d="M12 3 5 6v6c0 4.500 3 7.500 7 9 4-1.500 7-4.500 7-9V6z" /><path d="m9 12 2 2 4-4" /></Ico>
              <h3>பாதுகாப்பான கட்டணம்</h3>
              <p>கட்டணம் <b>PayU</b> கட்டண நுழைவாயில் வழியாகச் செலுத்தப்படுகிறது. UPI, கார்டு, நெட் பேங்கிங் பயன்படுத்தலாம்.</p>
            </div>
            <div>
              <Ico w={1.7}><path d="M4 12a8 8 0 1 0 3-6.200M4 4v4h4" /><path d="M12 8v8M9.500 10.500h4a1.500 1.500 0 0 1 0 3h-3" /></Ico>
              <h3>பணம் வாபஸ்</h3>
              <p>PONNA.in-ல் பயிற்சி பெற்று அரசுப் பணியில் சேர்ந்தால், பயிற்சிக் கட்டணம் முழுவதும் திரும்பக் கிடைக்கும்.*</p>
            </div>
            <div>
              <Ico w={1.7}>{PhonePath}</Ico>
              <h3>நேரடியாகப் பேசலாம்</h3>
              <p>சந்தேகம் இருந்தால் <b style={{ whiteSpace: 'nowrap' }}>{PHONE_DISPLAY}</b> என்ற எண்ணில் அழைக்கலாம் அல்லது WhatsApp-ல் கேட்கலாம்.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec" id="pass">
        <div className="wrap pass">
          <div>
            <h2>PONNA Pass</h2>
            <p className="lead">எல்லா TNPSC தேர்வுகளுக்கும் ஒரே Pass. இப்போது Group 4 முழுமையாகத் திறந்துள்ளது; Pass காலத்தில் திறக்கப்படும் மற்ற தேர்வுகளும் இதே Pass-ல் கிடைக்கும். முதலில் இலவசமாகப் பயிற்சி செய்து பாருங்கள்; பிடித்திருந்தால் மட்டும் Pass எடுங்கள்.</p>
            <ul className="ticks">
              <li>திறந்துள்ள தேர்வுகளின் கேள்விப் பயிற்சி</li>
              <li>Live Exam, Adaptive Mock</li>
              <li>தினசரி Current Affairs</li>
              <li>Study Notes</li>
              <li>Review Mistakes</li>
              <li>Ask PONNA</li>
            </ul>
          </div>
          <div>
            <div className="price">
              <div className="price-top">PONNA Pass — எல்லா TNPSC தேர்வுகளுக்கும்</div>
              <div className="price-body">
                <div className="amt">₹499<small>Group 4 தேர்வு நாள் வரை</small></div>
                <a className="btn btn-gold btn-lg" href="/plans" onClick={passClick}>PONNA Pass பெறுங்கள்</a>
                <p className="pay">PayU வழியாகப் பாதுகாப்பான கட்டணம்</p>
              </div>
            </div>
            <div className="refund"><b>* பணம் வாபஸ் நிபந்தனை:</b> உங்கள் ஹால் டிக்கெட் எண்ணை PONNA.in சுயவிவரத்தில் பதிவு செய்து, அது சரிபார்க்கப்பட வேண்டும். <a href="/refund-policy" style={{ textDecoration: 'underline' }}>முழு விவரம்</a></div>
          </div>
        </div>
      </section>

      <section className="purpose">
        <div className="wrap">
          <blockquote>அரசு வேலைக்குத் தயாராகும் ஒரு மாணவரின் பொருளாதார நிலை, அவரது கனவுக்குத் தடையாக இருக்கக் கூடாது.</blockquote>
          <p>அதிகக் கட்டணம் செலுத்திப் பயிற்சி மையங்களுக்குச் செல்ல முடியாத மாணவர்களுக்கும், குறைந்த கட்டணத்தில் தரமான பயிற்சி கிடைக்க வேண்டும். அதற்காகவே PONNA.in உருவாக்கப்பட்டது.</p>
        </div>
      </section>

      <section className="sec" id="faq">
        <div className="wrap faq">
          <div className="side">
            <h2>அடிக்கடி கேட்கப்படும் கேள்விகள்</h2>
            <p>இங்கே பதில் இல்லையென்றால், எங்களிடம் நேரடியாகக் கேளுங்கள்.</p>
            <a className="btn btn-line" href="/contact">தொடர்பு கொள்ளுங்கள்</a>
          </div>
          <div>
            <details open><summary>இலவசமாக முயற்சி செய்ய முடியுமா?</summary><p>முடியும். பதிவு செய்யாமலேயே இலவசக் கேள்விகளுக்குப் பதில் சொல்லிப் பார்க்கலாம். பதிவு செய்தால் தினமும் இலவசக் கேள்விகள் கிடைக்கும்.</p></details>
            <details><summary>Pass எடுத்தால் என்ன கிடைக்கும்?</summary><p>எல்லா TNPSC தேர்வுகளுக்கும் ஒரே PONNA Pass. இப்போது Group 4 பயிற்சிக் கேள்விகள், Live Exam, Adaptive Mock, Study Notes, Review Mistakes, Ask PONNA ஆகியவை கிடைக்கும். Pass காலத்தில் திறக்கப்படும் மற்ற தேர்வுகளும் இதே Pass-ல் சேரும்.</p></details>
            <details><summary>கட்டணம் எப்படிச் செலுத்துவது?</summary><p>Plans பக்கத்தில் PayU வழியாக UPI, டெபிட் / கிரெடிட் கார்டு அல்லது நெட் பேங்கிங் மூலம் செலுத்தலாம்.</p></details>
            <details><summary>செலுத்திய பணம் திரும்பக் கிடைக்குமா?</summary><p>PONNA.in-ல் பயிற்சி பெற்று அரசுப் பணியில் சேர்ந்தால், பயிற்சிக் கட்டணம் முழுவதும் திரும்பக் கிடைக்கும். ஹால் டிக்கெட் எண்ணைச் சுயவிவரத்தில் பதிவு செய்து சரிபார்க்க வேண்டும்.</p></details>
            <details><summary>PONNA.in-ஐ நடத்துவது யார்?</summary><p>தமிழ்நாட்டில் பதிவு செய்யப்பட்ட ARLENA (OPC) Private Limited நிறுவனம். நிறுவன விவரங்கள் இந்தப் பக்கத்தின் கீழே உள்ளன.</p></details>
          </div>
        </div>
      </section>

      <section className="close">
        <div className="wrap">
          <div>
            <h2>இன்றே ஒரு கேள்வியிலிருந்து தொடங்குங்கள்</h2>
            {days !== null && <p>தேர்வுக்கு இன்னும் {days} நாட்கள் உள்ளன.</p>}
          </div>
          <a className="btn btn-navy btn-lg" href="/quiz" onClick={startClick}>இலவசமாகப் பயிற்சி தொடங்குங்கள்</a>
        </div>
      </section>

      <SiteFooter onStart={onStart} />
    </main>
  );
}
