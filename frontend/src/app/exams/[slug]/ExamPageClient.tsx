'use client';

// One page per TNPSC exam. A "ready" exam links to everything that is open
// for it; a "விரைவில்" exam says plainly what is being prepared and points to
// the parts of PONNA.in that are useful for every exam meanwhile. No exam
// facts (dates, vacancies) are stated here unless they come from an official
// notification already published on the site.

import { findExam } from '../../../lib/exams';
import { SiteHeader, SiteFooter, useGroup4Days } from '../../../components/site/SiteChrome';
import { StudentMenu } from '../../../components/StudentMenu';
import '../../../components/home-v2.css';

type Row = { name: string; what: string; href?: string };

const READY_ROWS: Row[] = [
  { name: 'கேள்விப் பயிற்சி', what: 'பாடவாரியாகக் கேள்விகள்; பதில் சொன்னவுடன் சரியான விடை.', href: '/quiz' },
  { name: 'Study Notes', what: 'இந்தத் தேர்வின் பாடத்திட்டப்படி பாடக்குறிப்புகள்.', href: '/study-notes' },
  { name: 'Live Exam', what: 'தேர்வு போன்ற சூழலில், நேரக் கட்டுப்பாட்டுடன் எழுதலாம்.', href: '/live-exam' },
  { name: 'Adaptive Mock', what: 'உங்கள் நிலைக்கேற்ப மாறும் மாதிரித் தேர்வு.', href: '/adaptive-mock' },
  { name: 'தேர்வு அறிவிப்பு', what: 'அறிவிப்பு 2026: தகுதி, வயது வரம்பு, தேதிகள், பாடத்திட்டம்.', href: '/tnpsc-group-4/notification-2026' },
  { name: 'Cut-off Predictor', what: 'உங்கள் மதிப்பெண்ணை வைத்து கட்-ஆஃப் கணிப்பு.', href: '/cutoff-predictor' },
];

const SOON_ROWS: Row[] = [
  { name: 'கேள்விப் பயிற்சி', what: 'இந்தத் தேர்வுக்கான கேள்விகள் தயாராகின்றன.' },
  { name: 'Study Notes', what: 'இந்தத் தேர்வின் பாடத்திட்டத்துக்கான தனிக் குறிப்புகள் தயாராகின்றன.' },
  { name: 'Live Exam', what: 'இந்தத் தேர்வின் முறைப்படி மாதிரித் தேர்வு.' },
  { name: 'தேர்வு அறிவிப்பு', what: 'TNPSC அறிவிப்பின் விவரங்கள் இங்கே சேர்க்கப்படும்.' },
];

export default function ExamPageClient({ slug }: { slug: string }) {
  const exam = findExam(slug)!;
  const days = useGroup4Days();
  const rows = exam.ready ? READY_ROWS : SOON_ROWS;

  return (
    <main className="pn2">
      <SiteHeader menu={<StudentMenu iconColor="#0A2A5E" />} />

      <section className="xhero">
        <div className="wrap">
          <div className="crumb"><a href="/">முகப்பு</a> &nbsp;›&nbsp; <a href="/#exams">TNPSC தேர்வுகள்</a> &nbsp;›&nbsp; {exam.name}</div>
          <h1>TNPSC {exam.name}</h1>
          <p className="full">{exam.fullName}{exam.posts ? ` — ${exam.posts}` : ''}</p>
          <span className={`tag${exam.ready ? '' : ' soon'}`}>{exam.ready ? 'பயிற்சி தயார்' : 'விரைவில்'}</span>
          {exam.ready && (
            <div className="cta">
              <a className="btn btn-gold btn-lg" href="/quiz">பயிற்சி தொடங்குங்கள்</a>
              <a className="btn btn-line btn-lg" href="/tnpsc-group-4/notification-2026">அறிவிப்பு முழு விவரம்</a>
            </div>
          )}
        </div>
      </section>

      <section className="sec">
        <div className="wrap">
          <div className="sec-h">
            <h2>{exam.ready ? 'இந்தத் தேர்வுக்கு PONNA.in-ல் உள்ளவை' : 'இந்தத் தேர்வுக்குத் தயாராகி வருபவை'}</h2>
            {exam.ready
              ? days !== null && <p>எழுத்துத் தேர்வு 10.01.2027. இன்னும் {days} நாட்கள் உள்ளன.</p>
              : <p>இவை தயாரானதும் இந்தப் பக்கத்திலேயே திறக்கப்படும்.</p>}
          </div>
          <div className="status">
            {rows.map((r) => (
              <div key={r.name}>
                <b>{r.name}</b>
                <span className="what">{r.what}</span>
                {r.href
                  ? <a className="btn btn-navy" href={r.href}>திறக்க</a>
                  : <span className="tag soon">விரைவில்</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {!exam.ready && (
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
