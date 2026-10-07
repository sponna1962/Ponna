// TNPSC Group 4 2026 notification guide (Oct 2026) — PONNA.in's flagship SEO
// asset. Server-rendered so the whole guide (text, tables, links, FAQ and
// structured data) is in the initial HTML for search engines; only the
// progress bar, table of contents behaviour, share, countdown and the
// copy-protection layer are client-side (see GuideClient.tsx).

import Image from 'next/image';
import content from '../../../content/g4-notification.json';
import { BitterFontLinks } from '../../../lib/brand-theme';
import { FAQS, PAGE_URL, SITE, STATS } from './guide-data';
import { Countdown, GuideToc, ProtectLayer, ReadingProgress, ShareButton } from './GuideClient';
import { GuideStyles } from './guide-styles';

type Section = { id: string; title: string; html: string };
const SECTIONS = content.sections as Section[];

const ld = (o: unknown) => ({ __html: JSON.stringify(o).replace(/</g, '\\u003c') });

export default function NotificationGuidePage() {
  const url = SITE + PAGE_URL;
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'TNPSC Group 4 தேர்வு 2026 – முழுமையான வழிகாட்டி (அறிவிப்பு எண் 11/2026)',
    description: 'TNPSC Group 4 அறிவிப்பு 11/2026-ன் முழு விவரம்: காலியிடங்கள், தகுதி, வயது, தேதிகள், விண்ணப்ப முறை, தேர்வு முறை, பாடத்திட்டம்.',
    inLanguage: 'ta',
    datePublished: '2026-10-07',
    dateModified: '2026-10-07',
    mainEntityOfPage: url,
    url,
    image: SITE + '/logo.png',
    author: { '@type': 'Organization', name: 'PONNA.in', url: SITE },
    publisher: { '@type': 'Organization', name: 'PONNA.in', logo: { '@type': 'ImageObject', url: SITE + '/logo-compact.png' } },
    about: 'TNPSC Group 4 (Combined Civil Services Examination-IV) Notification No. 11/2026',
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: 'ta',
    mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'TNPSC Group 4', item: SITE + '/tnpsc-group-4' },
      { '@type': 'ListItem', position: 3, name: 'Group 4 அறிவிப்பு 2026', item: url },
    ],
  };

  return (
    <div className="g4n" lang="ta">
      <BitterFontLinks />
      <GuideStyles />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(article)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbs)} />
      <ProtectLayer />

      <header className="g4n-top">
        <div className="g4n-top-in">
          <a href="/" className="g4n-logo" aria-label="PONNA.in முகப்பு">
            <Image src="/logo-compact.png" alt="PONNA.in" width={140} height={37} priority />
          </a>
          <div className="g4n-top-r">
            <ShareButton />
            <a href="/tnpsc-group-4" className="g4n-btn-ghost g4n-noprint">TNPSC Group 4</a>
          </div>
        </div>
        <ReadingProgress />
      </header>

      <nav className="g4n-bc" aria-label="Breadcrumb">
        <a href="/">Home</a> › <a href="/tnpsc-group-4">TNPSC Group 4</a> › <span>Group 4 அறிவிப்பு 2026</span>
      </nav>

      <div className="g4n-hero-wrap">
        <section className="g4n-hero" aria-labelledby="g4n-h1">
          <div className="g4n-eyebrow">பொன்னா.in வழங்கும் சிறப்பு வழிகாட்டி</div>
          <h1 id="g4n-h1">TNPSC Group 4 தேர்வு 2026<br />முழுமையான வழிகாட்டி</h1>
          {content.heroParas.map((p, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
          ))}
          <div className="g4n-tags">
            {['Advertisement No. 747', 'Notification No. 11/2026', '6,574 காலிப்பணியிடங்கள்', '200 கேள்விகள்', '300 மதிப்பெண்கள்'].map((t) => (
              <span className="g4n-tag" key={t}>{t}</span>
            ))}
          </div>
          <Countdown />
        </section>
      </div>

      <div className="g4n-stats">
        {STATS.map((s) => (
          <a key={s.label} href={s.href} className="g4n-stat">
            <b>{s.value}</b>
            <span>{s.label}</span>
          </a>
        ))}
      </div>

      <div className="g4n-note">
        <div dangerouslySetInnerHTML={{ __html: content.note }} />
      </div>

      <div className="g4n-layout">
        <GuideToc items={SECTIONS.map((s) => ({ id: s.id, title: s.title }))} />

        <main className="g4n-main">
          <section className="g4n-faq" id="faq" aria-labelledby="g4n-faq-h">
            <h2 id="g4n-faq-h">விரைவுப் பதில்கள் — Group 4 2026</h2>
            {FAQS.map((f, i) => (
              <details key={f.q} open={i < 3}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="g4n-sec" aria-labelledby={`h-${s.id}`}>
              <h2 id={`h-${s.id}`}>{s.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: s.html }} />
            </section>
          ))}

          <aside className="g4n-cta g4n-noprint" aria-label="PONNA பயிற்சி">
            <h2>அறிவிப்பைப் படித்தாயிற்று — இனி பயிற்சி!</h2>
            <p>TNPSC Group 4 தேர்வுக்கு PONNA.in-ல் கேள்விகளுடன் பயிற்சி செய்யுங்கள். பாடம் வாரியாகப் பயிற்சி, ஆன்லைன் தேர்வு, விளக்கத்துடன் விடைகள்.</p>
            <div className="g4n-cta-row">
              <a className="g4n-btn-gold" href="/quiz">பயிற்சியைத் தொடங்குங்கள்</a>
              <a className="g4n-btn-ghost" style={{ display: 'inline-block' }} href="/tnpsc-group-4/online-test">ஆன்லைன் தேர்வு</a>
              <a className="g4n-btn-ghost" style={{ display: 'inline-block' }} href="/tnpsc-group-4/question-bank">Question Bank</a>
            </div>
          </aside>
        </main>
      </div>

      <footer className="g4n-foot">
        <div dangerouslySetInnerHTML={{ __html: content.footer }} />
        <p>மூலம்: TNPSC அறிவிப்பு எண் 11/2026 · <a href="https://www.tnpsc.gov.in" rel="noopener noreferrer" target="_blank" style={{ color: 'inherit' }}>www.tnpsc.gov.in</a></p>
      </footer>
    </div>
  );
}
