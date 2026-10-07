'use client';

import Image from 'next/image';
import { BitterFontLinks } from '../lib/brand-theme';

const tools = [
  { title: 'Start Practice', body: 'கேள்விகளைத் தேர்ந்தெடுத்து பயிற்சி செய்யலாம்.', href: '/quiz', photo: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=240&h=240&fit=crop&q=80' },
  { title: 'Ask PONNA', body: 'தேர்வு தொடர்பான சந்தேகங்களுக்கு விளக்கம் பெறலாம்.', href: '/ask-ponna', photo: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=240&h=240&fit=crop&q=80' },
  { title: 'Review Mistakes', body: 'தவறான கேள்விகளை மீண்டும் பார்க்கலாம்.', href: '/mistakes', photo: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=240&h=240&fit=crop&q=80' },
  { title: 'Study Notes', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களைப் படிக்கலாம்.', href: '/study-notes', photo: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=240&h=240&fit=crop&q=80' },
  { title: 'Daily Challenge', body: 'Current Affairs மற்றும் Brain Challenge என இரண்டு தினசரி பயிற்சிகளைப் பெறலாம்.', href: '/daily-quiz', photo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=240&h=240&fit=crop&q=80' },
  { title: 'Live Exam', body: 'தேர்வு போன்ற சூழலில் தேர்வு எழுதலாம்.', href: '/live-exam', photo: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=240&h=240&fit=crop&q=80' },
  { title: 'Adaptive Mock', body: 'உங்கள் பயிற்சிக்கேற்ப மாற்றித் தேர்வு வழங்கப்படும்.', href: '/adaptive-mock', photo: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=240&h=240&fit=crop&q=80' },
  { title: 'Performance', body: 'உங்கள் மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்.', href: '/dashboard', photo: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=240&h=240&fit=crop&q=80' },
  { title: 'Cut-off Predictor', body: 'உங்கள் மதிப்பெண் அடிப்படையில் கட்-ஆஃப் கணிப்பைப் பார்க்கலாம்.', href: '/cutoff-predictor', photo: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=240&h=240&fit=crop&q=80' },
];

const featured = [
  {
    title: 'Current Affairs',
    body: 'தேர்வுக்குத் தேவையான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படிக்கலாம்.',
    href: '/current-affairs',
    photo: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=240&h=180&fit=crop&q=80',
    badge: 'புதியது',
  },
  {
    title: 'TNPSC Group 4 2026 அறிவிப்பு',
    body: 'காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளலாம்.',
    href: '/tnpsc-group-4/notification-2026',
    photo: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=240&h=180&fit=crop&q=80',
    badge: '',
  },
];

export default function HomeDesignPreview() {
  return (
    <main className="home-preview">
      <BitterFontLinks />

      <header className="site-header">
        <button className="menu-button" aria-label="மெனு"><span /><span /><span /></button>
        <a href="/" className="brand">
          <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority />
        </a>
        <a href="/" className="login">உள்நுழைவு</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">TNPSC தேர்வுக்கான பயிற்சி</div>
          <h1>Group 4 தேர்வுக்கு<br /><em>திட்டமிட்டுப் பயிற்சி</em><br />செய்யுங்கள்</h1>
          <ul>
            <li>பாடவாரியாகப் பயிற்சி</li>
            <li>மாதிரித் தேர்வுகள்</li>
            <li>முன்னேற்றத்தைப் பார்க்கலாம்</li>
          </ul>
          <a href="/quiz" className="primary-button">இப்போதே பயிற்சியைத் தொடங்குங்கள் <b>→</b></a>
        </div>
        <div className="hero-photo">
          <img src="/ponna-hero-woman.jpg" alt="PONNA தேர்வுக்குத் தயாராகும் மாணவி" />
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

        <section className="final-strip">
          <h3>தேர்வுப் பயிற்சியைத் தொடங்குங்கள்</h3>
          <p>உங்களுக்குத் தேவையான பயிற்சி வசதிகள் அனைத்தும் ஒரே இடத்தில்.</p>
          <a href="/quiz">பயிற்சியைத் தொடங்குங்கள் →</a>
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
          display: flex;
          flex-direction: column;
          background: #F1FAF3;
          border-bottom: 1px solid #DCE9DF;
          overflow: hidden;
        }
        .hero-copy { padding: 22px 18px 18px; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 19px; line-height: 1.4; margin-bottom: 5px; }
        h1 { margin: 0; color: #0B3864; font-size: 34px; line-height: 1.28; letter-spacing: -0.25px; }
        h1 em { color: #E3313D; font-style: normal; }
        .hero ul {
          list-style: none;
          padding: 0;
          margin: 14px 0 0;
          display: grid;
          gap: 5px;
          font-size: 18px;
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
          width: 100%;
          height: 250px;
          overflow: hidden;
          background: #EAF3F0;
        }
        .hero-photo img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          object-position: center 42%;
        }

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
          .hero-copy { padding: 19px 14px 16px; }
          .eyebrow { font-size: 17px; }
          h1 { font-size: 30px; }
          .hero ul { font-size: 17px; }
          .primary-button { font-size: 16px; }
          .hero-photo { height: 225px; }
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
