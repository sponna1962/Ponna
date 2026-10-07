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
          <Image
            src="/ponna-hero-woman.jpg"
            alt="PONNA தேர்வுக்குத் தயாராகும் மாணவி"
            fill
            priority
            sizes="42vw"
          />
        </div>
      </section>

      <section className="content">
        <a href="/current-affairs" className="wide-card current">
          <span className="wide-icon"><StudyNotesIcon size={28} color="#2085C7" /></span>
          <span className="wide-copy">
            <strong>Current Affairs</strong>
            <small>தேர்வுக்குத் தேவையான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படிக்கலாம்.</small>
          </span>
          <mark>புதியது</mark>
          <span className="arrow">›</span>
        </a>

        <a href="/tnpsc-group-4/notification-2026" className="notice-banner">
          <div className="notice-mark">4</div>
          <div className="notice-text">
            <strong>TNPSC Group 4 <span>2026 அறிவிப்பு</span></strong>
            <p>காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளலாம்.</p>
            <b>முழு விவரங்கள் →</b>
          </div>
          <span className="arrow">›</span>
        </a>

        <div className="tools-grid">
          {tools.map((item) => {
            return (
              <a key={item.title} href={item.href} className="tool-card">
                <img className="tool-photo" src={item.photo} alt="" loading="lazy" />
                <span className="tool-copy">
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </span>
                <span className="tool-arrow">›</span>
              </a>
            );
          })}
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
          display: grid;
          grid-template-columns: 58% 42%;
          min-height: 310px;
          background: #F1FAF3;
          border-bottom: 1px solid #DCE9DF;
          overflow: hidden;
        }
        .hero-copy { padding: 22px 8px 20px 17px; position: relative; z-index: 2; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 18px; line-height: 1.45; margin-bottom: 6px; }
        h1 { margin: 0; color: #0B3864; font-size: 30px; line-height: 1.3; letter-spacing: -0.2px; }
        h1 em { color: #E3313D; font-style: normal; }
        .hero ul {
          list-style: none;
          padding: 0;
          margin: 13px 0 0;
          display: grid;
          gap: 5px;
          font-size: 17px;
          font-weight: 700;
          line-height: 1.45;
        }
        .hero li::before { content: '✓'; color: #17835E; margin-right: 6px; font-weight: 900; }
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
          padding: 10px 8px;
          min-height: 50px;
          font-size: 16px;
          line-height: 1.35;
          margin-top: 14px;
          text-align: center;
        }
        .hero-photo { position: relative; min-height: 310px; overflow: hidden; }
        .hero-photo :global(img) { object-fit: cover; object-position: center; }

        .content { padding: 12px 10px 0; }
        .wide-card {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 86px;
          padding: 11px;
          margin-top: 8px;
          border: 1px solid #DDE5E9;
          border-radius: 10px;
          text-decoration: none;
        }
        .current { background: #F3F8FC; }
        .wide-icon {
          width: 48px;
          height: 48px;
          flex: 0 0 48px;
          background: #fff;
          border-radius: 10px;
          display: grid;
          place-items: center;
        }
        .wide-copy { flex: 1; min-width: 0; }
        .wide-card strong { display: block; color: #0B3864; font-size: 20px; line-height: 1.35; }
        .wide-card small { display: block; color: #4F6272; font-size: 16px; line-height: 1.5; margin-top: 2px; }
        .wide-card mark {
          color: #E3313D;
          background: #fff;
          border-radius: 6px;
          padding: 5px 7px;
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
        }
        .arrow { color: #20384D; font-size: 30px; line-height: 1; flex: 0 0 auto; }

        .notice-banner {
          margin: 8px 0;
          border: 1px solid #CFE5D8;
          border-radius: 10px;
          background: #EFF9F1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px;
          text-decoration: none;
        }
        .notice-mark {
          width: 45px;
          flex: 0 0 45px;
          align-self: stretch;
          border-right: 1px solid #BFD7C6;
          display: grid;
          place-items: center;
          color: #0B3864;
          font-size: 36px;
          font-weight: 900;
        }
        .notice-text { flex: 1; min-width: 0; }
        .notice-banner strong { color: #0B3864; font-size: 20px; line-height: 1.35; display: block; }
        .notice-banner strong span { color: #E3313D; }
        .notice-banner p { color: #4F6272; font-size: 16px; margin: 3px 0 8px; line-height: 1.45; }
        .notice-banner b {
          display: inline-block;
          color: #fff;
          background: #17835E;
          border-radius: 7px;
          padding: 7px 10px;
          font-size: 15px;
          line-height: 1.3;
        }

        .tools-grid { display: grid; grid-template-columns: 1fr; gap: 7px; }
        .tool-card {
          min-height: 86px;
          border: 1px solid #DDE5E9;
          border-radius: 10px;
          padding: 9px 10px;
          text-decoration: none;
          background: #fff;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tool-photo {
          width: 68px;
          height: 68px;
          object-fit: cover;
          border-radius: 7px;
          flex: 0 0 68px;
          display: block;
        }
        .tool-copy { flex: 1; min-width: 0; }
        .tool-copy strong { color: #0B3864; font-size: 19px; line-height: 1.3; display: block; }
        .tool-copy p { color: #4F6272; font-size: 16px; line-height: 1.45; margin: 2px 0 0; }
        .tool-arrow { color: #536575; font-size: 29px; line-height: 1; flex: 0 0 auto; }

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
          .hero { grid-template-columns: 60% 40%; min-height: 300px; }
          .hero-copy { padding-left: 13px; }
          .eyebrow { font-size: 16px; }
          h1 { font-size: 27px; }
          .hero ul { font-size: 16px; }
          .primary-button { font-size: 15px; }
          .wide-card small, .notice-banner p, .tool-copy p { font-size: 15px; }
          .tool-photo { width: 60px; height: 60px; flex-basis: 60px; }
        }
      `}
      </style>
    </main>
  );
}
