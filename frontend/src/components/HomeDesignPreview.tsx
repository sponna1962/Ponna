'use client';

import type { MouseEvent, ReactNode } from 'react';
import Image from 'next/image';
import { BitterFontLinks } from '../lib/brand-theme';

const tools = [
  { title: 'Ask PONNA', body: 'தேர்வு தொடர்பான சந்தேகங்களுக்கு விளக்கம் பெறலாம்.', href: '/ask-ponna', photo: '/home/tile-4.jpg' },
  { title: 'Review Mistakes', body: 'தவறான கேள்விகளை மீண்டும் பார்க்கலாம்.', href: '/mistakes', photo: '/home/tile-5.jpg' },
  { title: 'Study Notes', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களைப் படிக்கலாம்.', href: '/study-notes', photo: '/home/tile-6.jpg' },
  { title: 'Daily Challenge', body: 'Current Affairs மற்றும் Brain Challenge என இரண்டு தினசரி பயிற்சிகளைப் பெறலாம்.', href: '/daily-quiz', photo: '/home/tile-1.jpg' },
  { title: 'Live Exam', body: 'தேர்வு போன்ற சூழலில் தேர்வு எழுதலாம்.', href: '/live-exam', photo: '/home/tile-7.jpg' },
  { title: 'Adaptive Mock', body: 'உங்கள் பயிற்சிக்கேற்ப மாற்றித் தேர்வு வழங்கப்படும்.', href: '/adaptive-mock', photo: '/home/tile-8.jpg' },
  { title: 'Performance', body: 'உங்கள் மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்.', href: '/dashboard', photo: '/home/tile-9.jpg' },
  { title: 'Cut-off Predictor', body: 'உங்கள் மதிப்பெண் அடிப்படையில் கட்-ஆஃப் கணிப்பைப் பார்க்கலாம்.', href: '/cutoff-predictor', photo: '/home/tile-2.jpg' },
];

type HomeDesignProps = {
  menu?: ReactNode;
  onLogin?: () => void;
  onStart?: () => void;
  notice?: string;
  account?: ReactNode;
};

const featured = [
  {
    title: 'TNPSC Group 4 2026 அறிவிப்பு',
    body: 'காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளலாம்.',
    href: '/tnpsc-group-4/notification-2026',
    photo: '/home/tile-2.jpg',
    badge: '',
  },
  {
    title: 'Current Affairs',
    body: 'தேர்வுக்குத் தேவையான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படிக்கலாம்.',
    href: '/current-affairs',
    photo: '/home/tile-1.jpg',
    badge: 'புதியது',
  },
];

export default function HomeDesignPreview({ menu, onLogin, onStart, notice, account }: HomeDesignProps = {}) {
  const startClick = onStart ? (e: MouseEvent) => { e.preventDefault(); onStart(); } : undefined;
  return (
    <main className="home-preview">
      <BitterFontLinks />

      <header className="site-header">
        {menu ? <div className="menu-slot">{menu}</div> : <button className="menu-button" aria-label="மெனு"><span /><span /><span /></button>}
        <a href="/" className="brand">
          <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority />
        </a>
        {account ? <div className="account-slot">{account}</div> : <a href="/?startLogin=1" className="login" onClick={onLogin ? (e) => { e.preventDefault(); onLogin(); } : undefined}>உள்நுழைவு</a>}
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">போட்டித் தேர்வுக்கான<br />பயிற்சி தளம்</div>
          <h1>Group 4 வெற்றிக்கான<br /><em>உங்கள் முயற்சி</em><br />இங்கே தொடங்கட்டும்</h1>
        </div>
        <div className="hero-photo">
          <img src="/ponna-hero-woman.jpg" alt="PONNA தேர்வுக்குத் தயாராகும் மாணவி" />
        </div>
        <div className="hero-actions">
          <a href="/quiz" className="primary-button" onClick={startClick}>பயிற்சி தொடங்குங்கள் <b>→</b></a>
        </div>
      </section>

      <section className="stat-strip" aria-label="PONNA எண்கள்">
        <div><strong>60,000+</strong><span>கேள்விகளில்<br />பயிற்சி</span></div>
        <div><strong>3,250+</strong><span>மாதாந்திர<br />பயிற்சி</span></div>
        <div><strong>4,000+</strong><span>பயிற்சி<br />முயற்சிகள்</span></div>
      </section>

      <section className="content">
        <div className="featured-list">
          {featured.map((item) => (
            <a key={item.title} href={item.href} className="featured-card">
              <img className="featured-photo" src={item.photo} alt="" loading="lazy" />
              <span className="featured-copy">
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </span>
              {item.badge && <mark>{item.badge}</mark>}
              <span className="arrow">›</span>
            </a>
          ))}
        </div>

        <section className="usp-section" aria-label="PONNA-வின் சிறப்பம்சங்கள்">
          <div className="usp-heading">
            <h2>PONNA ஏன்?</h2>
            <span>எளிமையான பயிற்சி. தெளிவான முன்னேற்றம்.</span>
          </div>
          <div className="usp-list">
            <article className="usp-item">
              <div className="usp-number">01</div>
              <div className="usp-copy">
                <strong>60,000+</strong>
                <p>புதிய பாடத்திட்டத்தின் கீழ் நிபுணர்கள் தயாரித்த<br />பயிற்சிக் கேள்விகள் மற்றும் பழைய டிஎன்பிசி கேள்வித்தாள்கள்</p>
              </div>
            </article>
            <article className="usp-item">
              <div className="usp-number">02</div>
              <div className="usp-copy">
                <strong>இணையமின்றி</strong>
                <p>இணைய இணைப்பு இல்லாவிட்டாலும்,<br />ஆஃப்லைன் முறையில் தொடர்ந்து பயிற்சி செய்யலாம்.</p>
              </div>
            </article>
            <article className="usp-item">
              <div className="usp-number">03</div>
              <div className="usp-copy">
                <strong>இரு மொழிகளில்</strong>
                <p>டிஎன்பிசி தேர்வுக்குத் தேவையான<br />தமிழ் மற்றும் ஆங்கிலத்தில் பயிற்சி செய்யலாம்.</p>
              </div>
            </article>
            <article className="usp-item">
              <div className="usp-number">04</div>
              <div className="usp-copy">
                <strong>உங்கள் நேரத்தில்</strong>
                <p>நேரம் கிடைக்கும் போதெல்லாம்,<br />எப்போது வேண்டுமானாலும் பயிற்சி செய்யலாம்.</p>
              </div>
            </article>
            <article className="usp-item">
              <div className="usp-number">05</div>
              <div className="usp-copy">
                <strong>அனைவருக்கும்</strong>
                <p>மாணவ–மாணவிகள், வேலைக்குச் செல்பவர்கள்,<br />வீட்டில் இருக்கும் பெண்கள் என அனைவரும் எளிதாகப் பயிற்சி செய்யலாம்.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="tools-section" aria-label="உங்கள் பயிற்சிக்கான கருவிகள்">
          <div className="tools-heading">
            <h2>உங்கள் பயிற்சிக்கான கருவிகள்</h2>
            <p>தேர்வுத் தயார்பை மேலும் எளிதாக்கும் வசதிகள்</p>
          </div>
          <div className="tools-grid">
          {tools.map((item) => (
            <a key={item.title} href={item.href} className="tool-card">
              <img className="tool-photo" src={item.photo} alt="" loading="lazy" />
              <span className="tool-copy">
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </span>
              <span className="tool-arrow">›</span>
            </a>
          ))}
        </div>

        <section className="purpose-section" aria-label="PONNA-வின் நோக்கம்">
          <div className="purpose-top">
            <div className="purpose-label">PONNA-வின் நோக்கம்</div>
            <span className="purpose-mark">நோக்கம்</span>
          </div>
          <h2>தரமான போட்டித் தேர்வுப் பயிற்சி<br /><span>அனைவருக்கும் கிடைக்க வேண்டும்.</span></h2>
          <div className="purpose-rule" />
          <p className="purpose-lead">அரசு வேலைக்குத் தயாராகும் ஒரு மாணவரின் பொருளாதார நிலை, அவரது கனவுக்குத் தடையாக இருக்கக் கூடாது.</p>
          <p>தனியார் பயிற்சி மையங்களில் அதிக கட்டணம் செலுத்த முடியாத மாணவர்களுக்கும், குறைந்த கட்டணத்தில் தரமான பயிற்சி கிடைக்க வேண்டும் என்பதற்காக PONNA உருவாக்கப்பட்டுள்ளது.</p>
          <div className="purpose-pillars">
            <div><strong>தரமான பயிற்சி</strong><span>நிபுணர்கள் உருவாக்கிய பயிற்சி</span></div>
            <div><strong>குறைந்த கட்டணம்</strong><span>அனைவருக்கும் எளிதில் கிடைக்க</span></div>
            <div><strong>அரசு வேலை</strong><span>உங்கள் கனவை நனவாக்க</span></div>
          </div>
          <p className="purpose-closing"><strong>இதுவே PONNA-வின் நோக்கம்.</strong></p>
        </section>

        <section className="pass-section" aria-label="உங்கள் PONNA Pass பெறுங்கள்">
          <div className="pass-head">
            <div>
              <div className="pass-label">உங்கள் PONNA Pass பெறுங்கள்</div>
              <h2>TNPSC Group 4 தேர்வுக்கான<br /><span>முழுமையான பயிற்சி.</span></h2>
            </div>
            <div className="pass-badge">GROUP 4</div>
          </div>
          <div className="pass-list">
            <div><b>60,000+</b><span>கேள்விகளில்<br />பயிற்சி</span></div>
            <div><b>தினசரி</b><span>Current Affairs &amp; Brain Challenge</span></div>
            <div><b>நேரடி</b><span>தேர்வுகளில் பங்கேற்பு</span></div>
          </div>
          <div className="ask-feature">
            <strong>Ask PONNA</strong>
            <span>தேர்வு தொடர்பான உங்கள் சந்தேகங்களுக்கு உடனடி வழிகாட்டுதல்</span>
          </div>
          <div className="pass-bottom">
            <p>உங்கள் Group 4 பயிற்சியை இன்றே தொடங்குங்கள்.</p>
            <a href="/plans" className="pass-button">PONNA Pass பெறுங்கள் <b>→</b></a>
          </div>
        </section>

        <section className="refund-box" aria-label="தேர்ச்சி பெற்றால் பணம் வாபஸ்">
          <h3>பணம் வாபஸ் பெறலாம்!</h3>
          <p>PONNA-வில் பயிற்சி பெற்று அரசு பணியில் சேர்ந்துவிட்டால், பயிற்சிக் கட்டணம் முழுவதும் திரும்ப கிடைத்துவிடும்.</p>
          <small>* நிபந்தனை: உங்கள் ஹால் டிக்கெட் எண்ணை PONNA-வில் உள்ள சுயவிவரத்தில் பதிவு செய்து, அதை அங்கீகரிக்க வேண்டும்.</small>
        </section>

        <section className="final-strip">
          <h3>தேர்வுப் பயிற்சியைத் தொடங்குங்கள்</h3>
          <p>உங்களுக்குத் தேவையான பயிற்சி வசதிகள் அனைத்தும் ஒரே இடத்தில்.</p>
          <a href="/quiz" onClick={startClick}>பயிற்சியைத் தொடங்குங்கள் →</a>
        </section>
      </section>


      <style jsx>{`
        .home-preview {
          width: 100%;
          max-width: 620px;
          margin: 0 auto;
          min-height: 100dvh;
          background: #fff;
          color: #20384D;
          font-family: 'Noto Sans Tamil', 'Nirmala UI', Latha, Arial, sans-serif;
          -webkit-text-size-adjust: 100%;
        }

        .site-header {
          height: 68px;
          background: #fff;
          border-bottom: 1px solid #DDE5E9;
          display: flex;
          align-items: center;
          padding: 0 12px;
          gap: 10px;
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .menu-slot { flex: 0 0 auto; display: flex; align-items: center; }
        .account-slot { flex: 0 0 auto; display: flex; align-items: center; }
        .notice { background: #FFF3CD; color: #5C4009; border-bottom: 1px solid #E8D28A; padding: 10px 14px; font-size: 14px; line-height: 1.5; }
        .menu-button {
          width: 42px;
          height: 42px;
          border: 0;
          background: transparent;
          display: grid;
          align-content: center;
          gap: 5px;
          padding: 7px;
          flex: 0 0 42px;
        }
        .menu-button span { display: block; height: 3px; width: 27px; background: #0B3864; border-radius: 2px; }
        .brand { flex: 1; display: flex; align-items: center; min-width: 0; }
        .brand :global(img) { width: 150px !important; height: auto !important; max-width: 100%; }
        .login {
          background: #0B3864;
          color: #fff;
          text-decoration: none;
          border-radius: 24px;
          padding: 11px 15px;
          font-weight: 800;
          font-size: 16px;
          white-space: nowrap;
        }

        .hero {
          position: relative;
          display: flex;
          flex-direction: column;
          min-height: 400px;
          background: #F1FAF3;
          border-bottom: 1px solid #DCE9DF;
          overflow: hidden;
        }
        .hero-copy { position: relative; z-index: 2; flex: 1; width: 200px; padding: 22px 0 88px 16px; min-width: 0; display: flex; flex-direction: column; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 13px; line-height: 1.5; margin-bottom: 6px; white-space: nowrap; }
        h1 { margin: 0 0 auto; color: #0B3864; font-size: 26px; line-height: 1.35; letter-spacing: -0.2px; }
        h1 em { color: #17835E; font-style: normal; }
        .hero ul {
          list-style: none;
          padding: 0;
          margin: 14px 0 0;
          padding-bottom: 6px;
          display: grid;
          gap: 5px;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
        }
        .hero li::before { content: '✓'; color: #17835E; margin-right: 7px; font-weight: 900; }
        .primary-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          background: #FFD22A;
          color: #20384D;
          text-decoration: none;
          font-weight: 900;
          border-radius: 10px;
          padding: 11px 10px;
          min-height: 56px;
          font-size: 18px;
          line-height: 1.3;
          margin-top: 15px;
          text-align: center;
        }
        .hero-photo {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
        }
        .hero-photo::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #F1FAF3 34%, rgba(241,250,243,0) 70%);
        }
        .hero-photo img {
          position: absolute;
          top: 0;
          right: 0;
          height: 100%;
          width: 78%;
          max-width: none;
          display: block;
          object-fit: cover;
          object-position: left top;
        }
        .hero-actions { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 0 14px 16px; }
        .hero-actions .primary-button { margin-top: 0; box-shadow: 0 6px 16px rgba(11,56,100,.15); }

        .stat-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: #0B3864; color: #fff; padding: 14px 4px; }
        .stat-strip div { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; text-align: center; padding: 0 4px; }
        .stat-strip div + div { border-left: 1px solid rgba(255,255,255,.25); }
        .stat-strip strong { color: #FFD22A; font-size: 21px; font-weight: 800; line-height: 1.2; }
        .stat-strip span { margin-top: 4px; font-size: 11.5px; line-height: 1.5; font-weight: 600; }
        .content { padding: 12px 10px 0; }
        .featured-list { display: grid; gap: 8px; }
        .featured-card {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 88px;
          padding: 9px 10px;
          border: 1px solid #DDE5E9;
          border-radius: 10px;
          background: #F3F8FC;
          text-decoration: none;
        }
        .featured-card:nth-child(2) { background: #EFF9F1; }
        .featured-photo {
          width: 66px;
          height: 58px;
          flex: 0 0 66px;
          object-fit: cover;
          border-radius: 7px;
        }
        .featured-copy { flex: 1; min-width: 0; }
        .featured-card strong {
          display: block;
          color: #0B3864;
          font-size: 22px;
          line-height: 1.3;
          font-weight: 900;
        }
        .featured-card small {
          display: block;
          color: #4F6272;
          font-size: 17px;
          line-height: 1.42;
          margin-top: 2px;
        }
        .featured-card mark {
          color: #E3313D;
          background: #fff;
          border-radius: 6px;
          padding: 5px 7px;
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
        }
        .arrow { color: #20384D; font-size: 31px; line-height: 1; flex: 0 0 auto; }

        .usp-section {
          margin: 12px 0 0;
          border-top: 1px solid #E4E8EA;
          border-bottom: 1px solid #E4E8EA;
          background: #fff;
        }
        .usp-heading {
          padding: 17px 14px 15px;
          background: #FFF9EA;
          border-bottom: 1px solid #E8E0C8;
        }
        .usp-heading h2 {
          margin: 0;
          color: #0B3864;
          font-size: 25px;
          line-height: 1.3;
          font-weight: 900;
        }
        .usp-heading h2::after {
          content: '';
          display: block;
          width: 42px;
          height: 3px;
          margin-top: 8px;
          background: #FFD22A;
        }
        .usp-heading span {
          display: block;
          margin-top: 7px;
          color: #667786;
          font-size: 13px;
          line-height: 1.45;
        }
        .usp-list { display: grid; }
        .usp-item {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr);
          gap: 12px;
          padding: 16px 12px;
          border-bottom: 1px solid #E2E7EA;
        }
        .usp-item:last-child { border-bottom: 0; }
        .usp-number {
          color: #A8BBD0;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: 29px;
          line-height: 1;
          font-weight: 700;
          padding-top: 2px;
          border-right: 1px solid #DCE3E8;
        }
        .usp-copy { min-width: 0; }
        .usp-copy strong {
          display: block;
          color: #0B3864;
          font-size: 23px;
          line-height: 1.3;
          font-weight: 900;
        }
        .usp-copy p {
          margin: 3px 0 0;
          color: #536575;
          font-size: 15.5px;
          line-height: 1.52;
        }

        .tools-section {
          margin-top: 12px;
          background: #F4F9FC;
          border-top: 1px solid #DDE8EF;
          border-bottom: 1px solid #DDE8EF;
          padding: 17px 10px 12px;
        }
        .tools-heading {
          padding: 0 4px 10px;
        }
        .tools-heading h2 {
          margin: 0;
          color: #0B3864;
          font-size: 23px;
          line-height: 1.35;
          font-weight: 900;
        }
        .tools-heading h2::before {
          content: '';
          display: inline-block;
          width: 4px;
          height: 25px;
          margin-right: 9px;
          vertical-align: -3px;
          background: #FFD22A;
          border-radius: 2px;
        }
        .tools-heading p {
          margin: 4px 0 0 13px;
          color: #667786;
          font-size: 13px;
          line-height: 1.45;
        }

        .purpose-section {
          margin: 20px 0 10px;
          padding: 23px 17px 20px;
          background: #0B3864;
          color: #fff;
          border-radius: 12px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 7px 18px rgba(11,56,100,.10);
        }
        .purpose-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 68px;
          height: 4px;
          background: #FFD22A;
        }
        .purpose-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 9px;
        }
        .purpose-label {
          color: #FFD22A;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .8px;
        }
        .purpose-mark {
          color: #D9E6EE;
          border: 1px solid rgba(255,255,255,.25);
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .purpose-section h2 {
          margin: 0;
          color: #fff;
          font-size: 24px;
          line-height: 1.42;
          font-weight: 900;
        }
        .purpose-section h2 span { color: #FFD22A; }
        .purpose-rule {
          width: 44px;
          height: 3px;
          background: #FFD22A;
          margin: 14px 0 12px;
        }
        .purpose-section p {
          margin: 0 0 9px;
          color: #E8EFF4;
          font-size: 15.5px;
          line-height: 1.62;
        }
        .purpose-section .purpose-lead {
          color: #fff;
          font-size: 16.5px;
          font-weight: 700;
        }
        .purpose-pillars {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin: 14px 0 2px;
          border-top: 1px solid rgba(255,255,255,.22);
          border-bottom: 1px solid rgba(255,255,255,.18);
        }
        .purpose-pillars div {
          padding: 11px 7px 10px;
          border-right: 1px solid rgba(255,255,255,.18);
        }
        .purpose-pillars div:last-child { border-right: 0; }
        .purpose-pillars strong {
          display: block;
          color: #fff;
          font-size: 14px;
          line-height: 1.35;
        }
        .purpose-pillars span {
          display: block;
          margin-top: 3px;
          color: #C9D7E0;
          font-size: 11px;
          line-height: 1.4;
        }
        .purpose-section .purpose-closing {
          margin: 13px 0 0;
          color: #FFD22A;
          font-size: 15px;
          line-height: 1.45;
        }

        .pass-section {
          margin: 12px 0 10px;
          padding: 18px 15px 15px;
          border: 1px solid #E2D5AA;
          border-radius: 12px;
          background: #FFFDF5;
        }
        .pass-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 12px;
          border-bottom: 1px solid #E9DFC3;
        }
        .pass-label {
          color: #B07A16;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .7px;
          margin-bottom: 4px;
        }
        .pass-section h2 {
          margin: 0;
          color: #0B3864;
          font-size: 20px;
          line-height: 1.4;
          font-weight: 900;
        }
        .pass-section h2 span { color: #B07A16; }
        .pass-badge {
          flex: 0 0 auto;
          color: #0B3864;
          background: #FFE9A8;
          border: 1px solid #E2B04A;
          border-radius: 7px;
          padding: 5px 7px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .8px;
        }
        .pass-list {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin-top: 11px;
          border-bottom: 1px solid #E9DFC3;
        }
        .pass-list div {
          padding: 4px 7px 11px;
          border-right: 1px solid #E9DFC3;
        }
        .pass-list div:last-child { border-right: 0; }
        .pass-list b {
          display: block;
          color: #0B3864;
          font-size: 14px;
          line-height: 1.3;
        }
        .pass-list span {
          display: block;
          margin-top: 3px;
          color: #667786;
          font-size: 11px;
          line-height: 1.4;
        }
        .ask-feature {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 11px;
          padding: 9px 10px;
          background: #fff;
          border-left: 4px solid #17835E;
          border-radius: 6px;
        }
        .ask-feature strong {
          flex: 0 0 auto;
          color: #17835E;
          font-size: 15px;
        }
        .ask-feature span {
          color: #4F6272;
          font-size: 12.5px;
          line-height: 1.45;
        }
        .pass-bottom {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }
        .pass-bottom p {
          flex: 1;
          margin: 0;
          color: #20384D;
          font-size: 13px;
          line-height: 1.4;
          font-weight: 700;
        }
        .pass-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          flex: 0 0 auto;
          min-height: 43px;
          padding: 9px 12px;
          border-radius: 8px;
          background: #FFD22A;
          color: #20384D;
          text-decoration: none;
          font-size: 14px;
          font-weight: 900;
          white-space: nowrap;
        }

        .tools-grid { display: grid; grid-template-columns: 1fr; gap: 7px; margin-top: 8px; }
        .tool-card {
          min-height: 82px;
          border: 1px solid #DDE5E9;
          border-radius: 10px;
          padding: 8px 10px;
          text-decoration: none;
          background: #fff;
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .tool-photo {
          width: 56px;
          height: 56px;
          object-fit: cover;
          border-radius: 7px;
          flex: 0 0 56px;
          display: block;
        }
        .tool-copy { flex: 1; min-width: 0; }
        .tool-copy strong { color: #0B3864; font-size: 22px; line-height: 1.28; display: block; font-weight: 900; }
        .tool-copy p { color: #4F6272; font-size: 17px; line-height: 1.42; margin: 2px 0 0; }
        .tool-arrow { color: #536575; font-size: 30px; line-height: 1; flex: 0 0 auto; }

        .refund-box {
          margin: 22px 0 12px;
          padding: 20px 16px;
          border: 1px solid #B9DEC7;
          background: #F1FAF3;
          text-align: center;
        }
        .refund-box h3 {
          margin: 0;
          color: #E3313D;
          font-size: 24px;
          line-height: 1.35;
          font-weight: 900;
        }
        .refund-box p {
          margin: 7px 0 0;
          color: #20384D;
          font-size: 16px;
          line-height: 1.55;
        }
        .refund-box small {
          display: block;
          margin-top: 9px;
          color: #667786;
          font-size: 13px;
        }

        .final-strip {
          margin: 12px 0 16px;
          padding: 19px 16px;
          border-radius: 10px;
          background: #0B3864;
          color: #fff;
        }
        .final-strip h3 { margin: 0; font-size: 22px; line-height: 1.4; }
        .final-strip p { margin: 6px 0 0; font-size: 16px; line-height: 1.5; }
        .final-strip a {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #FFD22A;
          color: #20384D;
          text-decoration: none;
          font-weight: 900;
          border-radius: 10px;
          padding: 12px 14px;
          min-height: 50px;
          font-size: 17px;
          margin-top: 12px;
        }

        @media (max-width: 380px) {
          .brand :global(img) { width: 132px !important; }
          .login { font-size: 14px; padding: 10px 12px; }
          .hero-copy { padding: 18px 0 0 12px; }
          .eyebrow { font-size: 12px; }
          h1 { font-size: 24px; }
          .hero ul { font-size: 14.5px; }
          .primary-button { font-size: 16px; }
          .featured-card small, .tool-copy p { font-size: 16px; }
          .featured-card strong, .tool-copy strong { font-size: 20px; }
          .featured-photo { width: 58px; height: 52px; flex-basis: 58px; }
          .tool-photo { width: 52px; height: 52px; flex-basis: 52px; }
        }
      `}
      </style>
    </main>
  );
}
