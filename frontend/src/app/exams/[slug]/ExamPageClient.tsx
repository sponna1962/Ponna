'use client';

// One page per TNPSC exam (Nov 2026). The bar under the title is the same for
// every exam, in the same order — பயிற்சி, Study Notes, பாடத்திட்டம், அறிவிப்பு,
// Live Exam, Cut-off — so a student who knows one exam page knows them all.
// A "ready" exam opens each part; a "விரைவில்" exam shows the same parts as
// not yet open. No exam facts (dates, vacancies) are stated unless they come
// from an official notification already published on the site.

import { findExam, GROUP4_SUBJECTS, GROUP4_TOTAL } from '../../../lib/exams';
import { SiteHeader, SiteFooter, useGroup4Days } from '../../../components/site/SiteChrome';
import { StudentMenu } from '../../../components/StudentMenu';
import '../../../components/home-v2.css';

const PARTS = [
  { id: 'practice', label: 'பயிற்சி' },
  { id: 'notes', label: 'Study Notes' },
  { id: 'syllabus', label: 'பாடத்திட்டம்' },
  { id: 'notification', label: 'அறிவிப்பு' },
  { id: 'live', label: 'Live Exam' },
  { id: 'cutoff', label: 'Cut-off' },
];

const SOON_TEXT: Record<string, string> = {
  practice: 'இந்தத் தேர்வுக்கான கேள்விப் பயிற்சி தயாராகிறது.',
  notes: 'இந்தத் தேர்வின் பாடத்திட்டத்துக்கான தனிக் குறிப்புகள் தயாராகின்றன.',
  syllabus: 'இந்தத் தேர்வின் பாடத்திட்டம் இங்கே சேர்க்கப்படும்.',
  notification: 'TNPSC அறிவிப்பின் விவரங்கள் இங்கே சேர்க்கப்படும்.',
  live: 'இந்தத் தேர்வின் முறைப்படி மாதிரித் தேர்வு.',
  cutoff: 'இந்தத் தேர்வுக்கான கட்-ஆஃப் விவரங்கள்.',
};

export default function ExamPageClient({ slug }: { slug: string }) {
  const exam = findExam(slug)!;
  const days = useGroup4Days();

  return (
    <main className="pn2">
      <SiteHeader menu={<StudentMenu iconColor="#0A2A5E" />} />

      <section className="xhero">
        <div className="wrap">
          <div className="crumb"><a href="/">முகப்பு</a> &nbsp;›&nbsp; <a href="/#exams">TNPSC தேர்வுகள்</a> &nbsp;›&nbsp; {exam.name}</div>
          <h1>TNPSC {exam.name}</h1>
          <p className="full">{exam.fullName}{exam.posts ? ` — ${exam.posts}` : ''}</p>
          {exam.ready ? (
            <>
              <ul className="xfacts">
                <li><b>{GROUP4_TOTAL}</b> கேள்விகள்</li>
                <li>தமிழ், ஆங்கிலம்</li>
                <li>தேர்வு: <b>10.01.2027</b>{days !== null && <> (இன்னும் {days} நாட்கள்)</>}</li>
              </ul>
              <div className="cta">
                <a className="btn btn-gold btn-lg" href="/quiz">இலவசமாகப் பயிற்சி தொடங்குங்கள்</a>
              </div>
            </>
          ) : (
            <span className="tag soon">விரைவில்</span>
          )}
        </div>
      </section>

      <nav className="xtabs" aria-label={`${exam.name} பகுதிகள்`}>
        <div className="wrap">
          {PARTS.map((p) => <a key={p.id} href={`#${p.id}`}>{p.label}</a>)}
        </div>
      </nav>

      {exam.ready ? (
        <>
          <section className="sec" id="practice">
            <div className="wrap">
              <div className="sec-h">
                <h2>பயிற்சி</h2>
                <p>பாடத்தைத் தேர்ந்தெடுத்துப் பயிற்சி செய்யுங்கள். பதில் சொன்னவுடன் சரியான விடை தெரியும்; ஒரே கேள்வி திரும்ப வராது.</p>
              </div>
              <div className="subjects">
                <div className="subjects-head"><span>பாடம்</span><span>கேள்விகள்</span><span /></div>
                {GROUP4_SUBJECTS.map((s) => (
                  <div key={s.name}>
                    <b>{s.name}</b>
                    <span className="num">{s.count}</span>
                    <a className="btn btn-line" href="/quiz">பயிற்சி செய்ய</a>
                  </div>
                ))}
              </div>
              <p className="soon-note">கேள்வி எண்ணிக்கை தமிழ், ஆங்கிலம் இரண்டும் சேர்த்து. பதிவு செய்யாமலேயே முதலில் முயற்சி செய்து பார்க்கலாம்.</p>
            </div>
          </section>

          <section className="sec sec-tint">
            <div className="wrap">
              <div className="parts">
                <div id="notes">
                  <h3>Study Notes</h3>
                  <p>Group 4 பாடத்திட்டப்படி ஒவ்வொரு பாடத்துக்கும் குறிப்புகள், தமிழிலும் ஆங்கிலத்திலும்.</p>
                  <a className="btn btn-navy" href="/study-notes">Study Notes திறக்க</a>
                </div>
                <div id="syllabus">
                  <h3>பாடத்திட்டம்</h3>
                  <p>தேர்வு முறை: 200 கேள்விகள், 300 மதிப்பெண்கள், 3 மணி நேரம். முழுப் பாடத்திட்டம் அறிவிப்பு வழிகாட்டியில்.</p>
                  <a className="btn btn-navy" href="/tnpsc-group-4/notification-2026#syllabus">பாடத்திட்டம் பார்க்க</a>
                </div>
                <div id="notification">
                  <h3>அறிவிப்பு 2026</h3>
                  <p>6,574 காலிப்பணியிடங்கள். தகுதி, வயது வரம்பு, தேதிகள், விண்ணப்ப முறை அனைத்தும் தமிழில்.</p>
                  <a className="btn btn-navy" href="/tnpsc-group-4/notification-2026">அறிவிப்பு முழு விவரம்</a>
                </div>
                <div id="live">
                  <h3>Live Exam, Adaptive Mock</h3>
                  <p>தேர்வு போன்ற சூழலில் நேரக் கட்டுப்பாட்டுடன் எழுதலாம்; உங்கள் நிலைக்கேற்ப மாறும் மாதிரித் தேர்வும் உண்டு.</p>
                  <div className="row"><a className="btn btn-navy" href="/live-exam">Live Exam</a><a className="btn btn-line" href="/adaptive-mock">Adaptive Mock</a></div>
                </div>
                <div id="cutoff">
                  <h3>Cut-off Predictor</h3>
                  <p>உங்கள் மதிப்பெண்ணை வைத்து கட்-ஆஃப் கணிப்பு.</p>
                  <a className="btn btn-navy" href="/cutoff-predictor">Cut-off பார்க்க</a>
                </div>
                <div>
                  <h3>Review Mistakes</h3>
                  <p>தவறிய கேள்விகள் தனியாகச் சேமிக்கப்படும்; அவற்றை மட்டும் மீண்டும் பயிற்சி செய்யலாம்.</p>
                  <a className="btn btn-navy" href="/mistakes">தவறுகளைப் பார்க்க</a>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="sec">
            <div className="wrap">
              <div className="sec-h">
                <h2>இந்தத் தேர்வுக்குத் தயாராகி வருபவை</h2>
                <p>இவை தயாரானதும் இந்தப் பக்கத்திலேயே திறக்கப்படும்.</p>
              </div>
              <div className="status">
                {PARTS.map((p) => (
                  <div key={p.id} id={p.id}>
                    <b>{p.label}</b>
                    <span className="what">{SOON_TEXT[p.id]}</span>
                    <span className="tag soon">விரைவில்</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="sec sec-tint">
            <div className="wrap">
              <div className="sec-h">
                <h2>இப்போதே பயன்படுத்தக்கூடியவை</h2>
                <p>இவை எல்லா TNPSC தேர்வுக்கும் பயன்படும்.</p>
              </div>
              <div className="now-grid">
                <a href="/current-affairs"><b>Current Affairs</b><span>தேர்வுக்கான நடப்பு நிகழ்வுகள், தினமும் புதிது.</span></a>
                <a href="/daily-quiz"><b>Daily Challenge</b><span>தினமும் Current Affairs, Brain Challenge கேள்விகள்.</span></a>
                <a href="/mind-gym"><b>Mind Gym</b><span>நினைவாற்றல், வேகம், சிந்தனைப் பயிற்சிகள்.</span></a>
                <a href="/exams/group-4"><b>TNPSC Group 4</b><span>Group 4 பயிற்சி இப்போது தயார்.</span></a>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="close">
        <div className="wrap">
          <div>
            <h2>{exam.ready ? 'இன்றே ஒரு கேள்வியிலிருந்து தொடங்குங்கள்' : 'இந்தத் தேர்வு பற்றிக் கேட்க வேண்டுமா?'}</h2>
            <p>{exam.ready ? 'பதிவு செய்யாமலேயே முதலில் முயற்சி செய்து பார்க்கலாம்.' : 'எங்களை அழைக்கலாம் அல்லது WhatsApp-ல் கேட்கலாம்.'}</p>
          </div>
          {exam.ready
            ? <a className="btn btn-navy btn-lg" href="/quiz">இலவசமாகப் பயிற்சி தொடங்குங்கள்</a>
            : <a className="btn btn-navy btn-lg" href="/contact">தொடர்பு கொள்ளுங்கள்</a>}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
