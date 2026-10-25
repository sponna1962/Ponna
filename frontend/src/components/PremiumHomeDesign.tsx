'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import Image from 'next/image';
import { BitterFontLinks } from '../lib/brand-theme';

type Props = {
  menu?: ReactNode;
  onLogin?: () => void;
  onStart?: () => void;
  notice?: string;
  account?: ReactNode;
};

const featureGroups = [
  { title: 'Practice', ta: 'வினா பயிற்சி', description: 'தமிழில் வினாக்களுடன் தினசரி பயிற்சி', href: '/quiz', icon: '▤' },
  { title: 'Live Exam', ta: 'நேரடித் தேர்வு', description: 'தேர்வு போன்ற சூழலில் பயிற்சி', href: '/live-exam', icon: '▣' },
  { title: 'Adaptive Mock', ta: 'மாற்றியமைக்கும் மாதிரித் தேர்வு', description: 'உங்கள் நிலைக்கேற்ற பயிற்சி', href: '/adaptive-mock', icon: '◉' },
  { title: 'Daily Challenge', ta: 'தினசரிச் சவால்', description: 'தினமும் அறிவை வளர்த்திடுங்கள்', href: '/daily-quiz', icon: '↗' },
  { title: 'Mind Gym', ta: 'சிந்தனைப் பயிற்சி', description: 'நினைவாற்றல், வேகம், சிந்தனை', href: '/mind-gym', icon: '✳' },
  { title: 'Study Notes', ta: 'பாடக்குறிப்புகள்', description: 'முக்கியப் பாடங்களை எளிதில் படிக்க', href: '/study-notes', icon: '▱' },
  { title: 'Current Affairs', ta: 'நடப்பு நிகழ்வுகள்', description: 'தேர்வுக்குத் தேவையான நடப்புச் செய்திகள்', href: '/current-affairs', icon: '▥' },
  { title: 'Ask PONNA', ta: 'உங்கள் கேள்விகளுக்கு உதவி', description: 'தேர்வு தொடர்பான சந்தேகங்களுக்கு விளக்கம்', href: '/ask-ponna', icon: '✧' },
  { title: 'Performance', ta: 'முன்னேற்றம்', description: 'உங்கள் பயிற்சி முன்னேற்றத்தைப் பாருங்கள்', href: '/dashboard', icon: '▥' },
  { title: 'Review Mistakes', ta: 'தவறுகளை மீண்டும் பாருங்கள்', description: 'தவறான வினாக்களை மீண்டும் பயிற்சி செய்யுங்கள்', href: '/mistakes', icon: '↻' },
  { title: 'Cut-off Predictor', ta: 'கட்-ஆஃப் கணிப்பு', description: 'மதிப்பெண் அடிப்படையில் கணிப்பைப் பாருங்கள்', href: '/cutoff-predictor', icon: '▤' },
];

export default function PremiumHomeDesign({ menu, onLogin, onStart, notice, account }: Props = {}) {
  const [countdown, setCountdown] = useState<{ application: number; exam: number } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const daysUntil = (y: number, m: number, d: number) =>
        Math.max(0, Math.ceil((new Date(y, m - 1, d).getTime() - today) / 86400000));
      setCountdown({ application: daysUntil(2026, 11, 5), exam: daysUntil(2027, 1, 10) });
    };
    update();
    const id = window.setInterval(update, 60 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const startClick = onStart ? (e: MouseEvent) => { e.preventDefault(); onStart(); } : undefined;
  const navLinks = [
    { label: 'தேர்வுகள்', href: '/tnpsc-group-4/notification-2026' },
    { label: 'பயிற்சி', href: '/quiz' },
    { label: 'படிப்பு', href: '/study-notes' },
    { label: 'என் முன்னேற்றம்', href: '/dashboard' },
    { label: 'Ask PONNA', href: '/ask-ponna' },
    { label: 'திட்டங்கள்', href: '/plans' },
    { label: 'ஆசிரியர்கள்', href: '/about' },
  ];

  return (
    <main className="ponna-home">
      <BitterFontLinks />
      <header className="topbar">
        <div className="nav-inner">
          <button className="hamburger" aria-label="மெனுவைத் திறக்கவும்" aria-expanded={mobileOpen} onClick={() => setMobileOpen(v => !v)}>
            <span /><span /><span />
          </button>
          <a href="/" className="logo" aria-label="PONNA முகப்பு">
            <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority />
          </a>
          <nav className="desktop-nav" aria-label="முதன்மை வழிசெலுத்தல்">
            {navLinks.map(link => <a key={link.label} href={link.href}>{link.label}<span aria-hidden="true">⌄</span></a>)}
          </nav>
          {account ? <div className="account-control">{account}</div> : <a href="/?startLogin=1" className="login-button" onClick={onLogin ? e => { e.preventDefault(); onLogin(); } : undefined}>உள்நுழைவு</a>}
        </div>
        {mobileOpen && <nav className="mobile-nav" aria-label="கைப்பேசி வழிசெலுத்தல்">
          {navLinks.map(link => <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)}>{link.label}<span>→</span></a>)}
          {menu && <div className="provided-menu">{menu}</div>}
        </nav>}
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-eyebrow">PONNA.in · உங்கள் தேர்வுத் துணை</div>
            <h1>TNPSC<br /><span>தேர்வுப் பயிற்சி</span></h1>
            <p>தமிழில், திட்டமிட்ட முறையில், வெற்றிக்கான பயணம்.</p>
            <a className="primary-cta" href="/quiz" onClick={startClick}>பயிற்சியைத் தொடங்குங்கள் <span>→</span></a>
            <div className="hero-promises">
              <span><b>✓</b> எளிய விளக்கம்</span>
              <span><b>✓</b> திட்டமிட்ட பயிற்சி</span>
              <span><b>✓</b> உங்கள் முன்னேற்றம்</span>
            </div>
          </div>
          <div className="hero-image">
            <Image src="/ponna-hero-woman-460.webp" alt="PONNA மூலம் தேர்வுக்குத் தயாராகும் மாணவி" width={460} height={690} priority />
            <div className="image-note">நான் முயற்சி செய்கிறேன். என்னால் முடியும்!</div>
          </div>
        </div>
      </section>

      <section className="dates" aria-label="Group 4 முக்கிய தேதிகள்">
        <div className="dates-intro"><span className="eyebrow">TNPSC GROUP 4</span><h2>முக்கிய தேதிகள்</h2><p>உங்கள் தயாரிப்பை இன்றே திட்டமிடுங்கள்.</p></div>
        <article className="date-item"><span className="date-symbol">▤</span><div><small>விண்ணப்பிக்கக் கடைசி நாள்</small><strong>05 நவம்பர் 2026</strong><b>{countdown ? countdown.application : '—'} நாட்கள் மீதம்</b></div></article>
        <article className="date-item"><span className="date-symbol">▦</span><div><small>தேர்வு நாள்</small><strong>10 ஜனவரி 2027</strong><b>{countdown ? countdown.exam : '—'} நாட்கள் மீதம்</b></div></article>
        <a className="dates-cta" href="/tnpsc-group-4/notification-2026">முழு அட்டவணை <span>→</span></a>
        <p className="dates-note">தேதிகளை அதிகாரப்பூர்வ TNPSC அறிவிப்பில் உறுதிப்படுத்தவும்.</p>
      </section>

      <section className="features section-wrap">
        <div className="section-heading"><span className="eyebrow">உங்கள் அடுத்த படி</span><h2>உங்கள் தயாரிப்புக்குத் தேவையானவை</h2><p>பயிற்சி முதல் முன்னேற்றம் வரை — அனைத்தும் ஒரே இடத்தில்.</p></div>
        <div className="feature-grid">
          {featureGroups.map((feature, i) => <a className="feature-card" href={feature.href} key={feature.title}>
            <span className="feature-icon" aria-hidden="true">{feature.icon}</span>
            <span className="feature-arrow" aria-hidden="true">↗</span>
            <strong>{feature.title}</strong><b>{feature.ta}</b><p>{feature.description}</p>
          </a>)}
        </div>
      </section>

      <section className="stats">
        <div><span className="stats-icon">♟</span><strong>50,000+</strong><small>பயிற்சி வினாக்கள்</small></div>
        <div><span className="stats-icon">▤</span><strong>3,250+</strong><small>பாடக்குறிப்புகள்</small></div>
        <div><span className="stats-icon">★</span><strong>4,000+</strong><small>மாதிரித் தேர்வுகள்</small></div>
      </section>

      <section className="closing">
        <div><span className="eyebrow">உங்கள் இலக்கு. உங்கள் முயற்சி.</span><h2>அரசுப் பணியில் சேரும் கனவை நனவாக்குங்கள்.</h2><p>திட்டமிட்டுப் பயிற்சி செய்து, வெற்றியை நோக்கி முன்னேறுங்கள்.</p></div>
        <a href="/quiz" onClick={startClick}>இப்போதே தொடங்குங்கள் <span>→</span></a>
      </section>

      <footer className="footer">
        <a href="/" className="footer-logo">PONNA.in</a>
        <nav aria-label="அடிக்குறிப்பு இணைப்புகள்"><a href="/tnpsc-group-4/notification-2026">Group 4 அறிவிப்பு</a><a href="/current-affairs">Current Affairs</a><a href="/study-notes">Study Notes</a><a href="/plans">PONNA Pass</a><a href="/about">Teachers</a><a href="/about">About</a><a href="/help">Help</a></nav>
        <small>PONNA.in · தேர்வுப் பயிற்சிக்கான தமிழ் தளம்</small>
      </footer>

      <style jsx>{`
        .ponna-home{--navy:#0b3b68;--navy-dark:#082e52;--paper:#fbfaf6;--gold:#ffc629;--ink:#123a61;--muted:#526981;--line:#dce4e9;width:100%;min-height:100dvh;background:var(--paper);color:var(--ink);font-family:'Noto Sans Tamil','Nirmala UI',Latha,Arial,sans-serif;-webkit-text-size-adjust:100%}
        *{box-sizing:border-box}.topbar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.97);border-bottom:1px solid var(--line)}
        .nav-inner{max-width:1440px;min-height:70px;margin:auto;padding:0 5.5%;display:flex;align-items:center;gap:26px}.logo{display:flex;align-items:center;flex:0 0 165px}.logo :global(img){width:165px;height:auto;max-width:100%}
        .desktop-nav{display:flex;align-items:center;justify-content:flex-end;gap:clamp(10px,1.5vw,24px);flex:1}.desktop-nav a,.footer nav a{font-size:13px;font-weight:800;color:var(--navy);text-decoration:none;white-space:nowrap}.desktop-nav a span{margin-left:5px;color:#b18722}
        .login-button{flex:0 0 auto;background:var(--navy);color:#fff;text-decoration:none;padding:12px 21px;border-radius:5px;font-size:14px;font-weight:900;white-space:nowrap}.account-control{flex:0 0 auto;max-width:210px}.account-control :global(button){max-width:100%}.hamburger{display:none}
        .mobile-nav{display:none}.notice{padding:10px 5%;background:#fff2c6;color:#4d3c10;font-size:14px}
        .hero{background:var(--paper);border-bottom:1px solid var(--line)}.hero-inner{max-width:1440px;min-height:390px;margin:auto;padding:34px 6.5% 24px;display:grid;grid-template-columns:1fr .95fr;align-items:center;gap:4%}
        .hero-copy{padding:10px 0 20px;position:relative;z-index:1}.hero-eyebrow,.eyebrow{display:block;color:#9b751c;font-size:13px;font-weight:900;letter-spacing:.04em;margin-bottom:12px}
        h1{margin:0;color:var(--navy);font-size:clamp(44px,5vw,76px);font-weight:950;line-height:1.13;letter-spacing:-.035em}h1 span{display:inline-block}.hero-copy>p{margin:18px 0 22px;color:var(--muted);font-size:clamp(16px,1.5vw,21px);line-height:1.7}
        .primary-cta,.dates-cta,.closing>a{display:inline-flex;align-items:center;justify-content:center;gap:18px;background:var(--navy);color:white;text-decoration:none;padding:14px 22px;min-height:48px;border-radius:5px;font-size:15px;font-weight:900}.primary-cta span,.dates-cta span,.closing>a span{font-size:20px}
        .hero-promises{display:flex;gap:20px;flex-wrap:wrap;margin-top:22px;color:var(--muted);font-size:13px;font-weight:700}.hero-promises b{color:var(--navy);margin-right:5px}
        .hero-image{position:relative;min-width:0;align-self:stretch;min-height:330px;max-height:420px;overflow:hidden;border-radius:7px;background:#e9eef0}.hero-image :global(img){width:100%;height:100%;position:absolute;inset:0;object-fit:cover;object-position:center 32%}.image-note{position:absolute;right:14px;bottom:14px;padding:8px 12px;background:var(--navy);color:#fff;font-size:14px;font-weight:800;border-radius:3px}
        .dates{max-width:1440px;margin:0 auto;padding:23px 6.5%;display:grid;grid-template-columns:1.1fr 1fr 1fr auto;align-items:center;gap:20px;background:var(--navy);color:#fff}.dates-intro .eyebrow{color:var(--gold);margin:0 0 5px}.dates h2{font-size:25px;line-height:1.3;margin:0}.dates-intro p{font-size:12px;color:#d5e2ec;margin:7px 0 0}.date-item{display:flex;align-items:flex-start;gap:13px;padding-left:18px;border-left:1px solid rgba(255,255,255,.3);min-width:0}.date-symbol{font-size:27px;color:var(--gold);line-height:1}.date-item small,.date-item strong,.date-item b{display:block}.date-item small{font-size:12px;color:#d6e4ee;line-height:1.5}.date-item strong{font-size:clamp(17px,1.6vw,23px);line-height:1.5;white-space:nowrap}.date-item b{font-size:13px;color:var(--gold);margin-top:2px}.dates-cta{background:var(--gold);color:var(--navy-dark);font-size:13px;padding:12px 15px;gap:8px}.dates-note{grid-column:1/-1;margin:0;color:#d0dfeb;font-size:10px}
        .section-wrap{max-width:1440px;margin:auto;padding:48px 5.5% 38px}.section-heading{margin-bottom:24px}.section-heading .eyebrow{margin-bottom:7px}.section-heading h2{margin:0;color:var(--navy);font-size:clamp(27px,3vw,38px);line-height:1.3}.section-heading p{margin:8px 0 0;color:var(--muted);font-size:15px;line-height:1.6}
        .feature-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.feature-card{position:relative;min-width:0;min-height:174px;padding:18px 17px 15px;display:flex;flex-direction:column;align-items:flex-start;background:#fff;border:1px solid #e1e7eb;border-radius:8px;color:var(--navy);text-decoration:none;transition:border-color .15s,transform .15s}.feature-card:hover{border-color:#9eb5c8;transform:translateY(-2px)}.feature-icon{display:grid;place-items:center;width:43px;height:43px;border-radius:50%;background:#eaf2fa;color:var(--navy);font-size:24px;font-weight:900;margin-bottom:12px}.feature-arrow{position:absolute;right:15px;top:22px;color:#d99b00;font-size:20px}.feature-card strong{font-size:16px;line-height:1.35;font-weight:900}.feature-card>b{font-size:13px;line-height:1.5;margin-top:2px;color:#274f75}.feature-card p{font-size:13px;line-height:1.6;color:var(--muted);margin:7px 0 0}
        .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));max-width:1440px;margin:0 auto;padding:19px 8%;background:#f0eee7;border-top:1px solid #e6e1d4;border-bottom:1px solid #e6e1d4}.stats>div{display:grid;grid-template-columns:auto 1fr;column-gap:13px;align-items:center;padding:0 20px;border-right:1px solid #c7d0d5}.stats>div:last-child{border-right:0}.stats-icon{grid-row:span 2;color:#edae17;font-size:33px}.stats strong{font-size:26px;color:var(--navy);line-height:1.3}.stats small{font-size:13px;color:var(--muted)}
        .closing{max-width:1440px;margin:auto;padding:30px 6.5%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:30px}.closing .eyebrow{color:var(--gold);margin-bottom:5px}.closing h2{font-size:clamp(23px,2.7vw,34px);line-height:1.35;margin:0;max-width:760px}.closing p{font-size:14px;color:#d8e4ec;margin:7px 0 0}.closing>a{background:var(--gold);color:var(--navy-dark);flex:0 0 auto}
        .footer{max-width:1440px;margin:auto;padding:18px 6.5% 14px;background:#fff;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px 25px}.footer-logo{color:var(--navy);font-size:24px;font-weight:950;text-decoration:none;letter-spacing:-.04em}.footer nav{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:12px 20px}.footer nav a{font-size:11px}.footer>small{grid-column:1/-1;padding-top:10px;border-top:1px solid var(--line);color:#718091;font-size:10px}
        @media(max-width:1100px){.nav-inner{gap:15px;padding:0 3%}.logo,.logo :global(img){flex-basis:135px;width:135px}.desktop-nav{gap:10px}.desktop-nav a{font-size:11px}.login-button{padding:11px 13px;font-size:12px}.hero-inner{padding-left:4%;padding-right:4%}.dates{padding-left:4%;padding-right:4%;gap:12px}.date-item{padding-left:12px}.feature-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.feature-card{padding:15px 13px}}
        @media(max-width:760px){.topbar{position:sticky}.nav-inner{min-height:60px;padding:0 16px;gap:13px}.hamburger{display:flex;flex:0 0 28px;width:28px;height:34px;padding:5px 2px;border:0;background:transparent;flex-direction:column;justify-content:center;gap:5px}.hamburger span{display:block;height:2px;width:23px;background:var(--navy);border-radius:2px}.logo{flex:1 1 auto;min-width:0}.logo :global(img){width:132px;height:auto}.desktop-nav{display:none}.login-button{font-size:12px;padding:9px 12px}.mobile-nav{display:grid;padding:7px 16px 14px;background:#fff;border-top:1px solid var(--line);grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.mobile-nav>a{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:11px 10px;border:1px solid var(--line);border-radius:5px;text-decoration:none;color:var(--navy);font-size:13px;font-weight:800}.mobile-nav>a span{color:#b88716}.provided-menu{grid-column:1/-1}
        .hero-inner{min-height:0;padding:24px 18px 20px;grid-template-columns:1fr;gap:18px}.hero-copy{padding:0}.hero-eyebrow{font-size:11px;margin-bottom:7px}h1{font-size:clamp(39px,11vw,54px);line-height:1.12}.hero-copy>p{font-size:15px;line-height:1.65;margin:10px 0 15px}.primary-cta{width:100%;min-height:48px;font-size:14px;padding:12px 15px}.hero-promises{gap:8px 14px;margin-top:14px;font-size:11px}.hero-image{min-height:220px;height:250px;max-height:270px}.hero-image :global(img){object-position:center 29%}.image-note{font-size:11px;right:8px;bottom:8px;padding:6px 8px}
        .dates{padding:20px 16px 14px;grid-template-columns:1fr 1fr;gap:13px 10px}.dates-intro{grid-column:1/-1}.dates h2{font-size:24px}.dates-intro p{font-size:12px}.date-item{padding-left:0;border-left:0;gap:8px}.date-symbol{font-size:21px}.date-item small{font-size:10px}.date-item strong{font-size:15px;white-space:normal;line-height:1.5}.date-item b{font-size:11px}.dates-cta{grid-column:1/-1;width:100%;min-height:42px}.dates-note{font-size:10px}
        .section-wrap{padding:29px 15px 25px}.section-heading{margin-bottom:16px}.section-heading .eyebrow{font-size:11px;margin-bottom:5px}.section-heading h2{font-size:26px;line-height:1.35}.section-heading p{font-size:13px;margin-top:5px}.feature-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.feature-card{min-height:155px;padding:13px 11px 12px;border-radius:6px}.feature-icon{width:36px;height:36px;font-size:20px;margin-bottom:8px}.feature-arrow{top:14px;right:11px;font-size:17px}.feature-card strong{font-size:14px;overflow-wrap:anywhere}.feature-card>b{font-size:11px}.feature-card p{font-size:11px;line-height:1.55;margin-top:5px}
        .stats{padding:14px 8px}.stats>div{padding:0 8px;grid-template-columns:1fr;gap:2px;text-align:center}.stats-icon{grid-row:auto;font-size:22px}.stats strong{font-size:19px}.stats small{font-size:10px;line-height:1.4}
        .closing{padding:22px 17px;display:grid;gap:14px}.closing h2{font-size:23px}.closing p{font-size:12px;line-height:1.6}.closing>a{width:100%;min-height:44px;font-size:13px}.footer{padding:16px;grid-template-columns:1fr;gap:11px}.footer-logo{font-size:22px}.footer nav{justify-content:flex-start;gap:10px 14px}.footer nav a{font-size:10px}.footer>small{font-size:9px;line-height:1.5}
        }
        @media(max-width:360px){.nav-inner{padding:0 10px;gap:8px}.logo :global(img){width:112px}.login-button{padding:8px 9px;font-size:11px}.hero-inner{padding-left:14px;padding-right:14px}.feature-card{padding:11px 9px}.feature-card strong{font-size:13px}.date-item strong{font-size:14px}}
        @media(prefers-reduced-motion:reduce){.feature-card{transition:none}.feature-card:hover{transform:none}}
      `}</style>
    </main>
  );
}
