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

type HomeDesignProps = {
  /** Real ☰ menu (the preview route shows a static icon). */
  menu?: ReactNode;
  /** Opens the login flow instead of navigating (live home page). */
  onLogin?: () => void;
  /** Start-practice handler instead of a plain link (live home page). */
  onStart?: () => void;
  /** Optional notice shown above the hero (e.g. logged out on another device). */
  notice?: string;
  /** Logged-in account button/menu shown instead of the login button. */
  account?: ReactNode;
};

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
          <ul>
            <li>60,000+ கேள்விகள்</li>
            <li>புதிய பாடத்திட்டம்</li>
            <li>நிபுணர்கள் உருவாக்கியது</li>
          </ul>
        </div>
        <div className="hero-photo">
          <img src="/ponna-hero-woman.jpg" alt="PONNA தேர்வுக்குத் தயாராகும் மாணவி" />
        </div>
        <div className="hero-actions">
          <a href="/quiz" className="primary-button" onClick={startClick}>பயிற்சி தொடங்குங்கள் <b>→</b></a>
        </div>
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
          <h2>PONNA-வின் சிறப்பம்சங்கள்</h2>
          <div className="usp-list">
            <article className="usp-item">
              <strong>60,000+</strong>
              <p>புதிய பாடத்திட்டத்தின் கீழ் நிபுணர்கள் தயாரித்தது<br />பழைய டிஎன்பிசி கேள்வித்தாள்கள்</p>
            </article>
            <article className="usp-item">
              <strong>இணையமின்றி</strong>
              <p>இணைய இணைப்பு இல்லாத நேரத்திலும்<br />கேள்விகளைப் பயிற்சி செய்யலாம்</p>
            </article>
            <article className="usp-item">
              <strong>மாதத்திற்கு</strong>
              <p>3,250+ கேள்விகள் தினசரி பயிற்சி மற்றும்<br />வாராந்திர நேரடித் தேர்வுகள் மூலம்</p>
            </article>
            <article className="usp-item">
              <strong>முயற்சிகள்</strong>
              <p>4,000+ பயிற்சி முயற்சிகள்<br />நேற்று PONNA-வில்</p>
            </article>
            <article className="usp-item">
              <strong>கட்டணம்</strong>
              <p>அதிக செலவின்றி, தரமான முழுமையான பயிற்சியை<br />PONNA-வில் பெறலாம்</p>
            </article>
          </div>
        </section>

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

        <section className="refund-box" aria-label="தேர்ச்சி பெற்றால் பணம் வாபஸ்">
          <h3>தேர்ச்சி பெற்றால் பணம் வாபஸ்!</h3>
          <p>PONNA-வில் பயிற்சி பெற்று தேர்ச்சி பெறுங்கள்.<br />தேர்ச்சி பெற்றால் பயிற்சிக் கட்டணம் திரும்ப வழங்கப்படும்.</p>
          <small>விதிமுறைகள் பொருந்தும்</small>
        </section>

        <section className="final-strip">
          <h3>தேர்வுப் பயிற்சியைத் தொடங்குங்கள்</h3>
          <p>உங்களுக்குத் தேவையான பயிற்சி வசதிகள் அனைத்தும் ஒரே இடத்தில்.</p>
          <a href="/quiz" onClick={startClick}>பயிற்சியைத் தொடங்குங்கள் →</a>
        </section>
      </section>

      <footer>வடிவமைப்பு முன்னோட்டம் · PONNA.in</footer>

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
        .account-slot { flex: 0 0 auto; display: flex; align-items: center; }
        .menu-slot { flex: 0 0 42px; display: flex; align-items: center; }
        .notice { background: #FFF3CD; color: #5C4009; border-bottom: 1px solid #E8D28A; padding: 10px 14px; font-size: 14px; line-height: 1.5; }
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
          min-height: 470px;
          background: #F1FAF3;
          border-bottom: 1px solid #DCE9DF;
          overflow: hidden;
        }
        .hero-copy { position: relative; z-index: 2; flex: 1; width: 55%; padding: 20px 0 0 14px; min-width: 0; display: flex; flex-direction: column; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 15px; line-height: 1.4; margin-bottom: 7px; }
        h1 { margin: 0 0 auto; color: #0B3864; font-size: 26px; line-height: 1.3; letter-spacing: -0.2px; }
        h1 em { color: #E3313D; font-style: normal; }
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
          inset: 0 0 88px 0;
          z-index: 1;
          pointer-events: none;
          overflow: hidden;
        }
        .hero-photo::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(241,250,243,0) 90%, #F1FAF3 100%), linear-gradient(90deg, rgba(241,250,243,0.95) 0%, rgba(241,250,243,0.9) 38%, rgba(241,250,243,0) 62%);
        }
        .hero-photo img {
          position: absolute;
          top: -6%;
          right: 0;
          height: 112%;
          width: auto;
          max-width: none;
          display: block;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 34%);
          mask-image: linear-gradient(90deg, transparent 0%, #000 34%);
        }
        .hero-actions { position: relative; z-index: 2; padding: 0 14px 18px; }
        .hero-actions .primary-button { margin-top: 14px; }

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
          padding: 18px 12px 4px;
          border-top: 2px solid #0B3864;
        }
        .usp-section h2 {
          margin: 0 0 8px;
          color: #0B3864;
          font-size: 23px;
          line-height: 1.35;
          font-weight: 900;
        }
        .usp-list { display: grid; gap: 0; }
        .usp-item {
          padding: 14px 4px;
          border-bottom: 1px solid #DDE5E9;
        }
        .usp-item strong {
          display: block;
          color: #0B3864;
          font-size: 24px;
          line-height: 1.25;
          font-weight: 900;
        }
        .usp-item p {
          margin: 3px 0 0;
          color: #4F6272;
          font-size: 16px;
          line-height: 1.5;
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
          border: 2px solid #E3313D;
          background: #FFF9F9;
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
        footer { padding: 0 12px 24px; text-align: center; color: #667786; font-size: 14px; }

        @media (max-width: 380px) {
          .brand :global(img) { width: 132px !important; }
          .login { font-size: 14px; padding: 10px 12px; }
          .hero-copy { padding: 18px 0 0 12px; }
          .eyebrow { font-size: 14px; }
          h1 { font-size: 23px; }
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
