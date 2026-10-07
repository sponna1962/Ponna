
'use client';

import Image from 'next/image';
import {
  PracticeIcon, ProgressIcon, AskPonnaIcon, MistakesIcon,
  StudyNotesIcon, DailyQuizIcon, LiveExamIcon, SubjectPreferenceIcon,
  CutoffPredictorIcon,
} from '../components/icons';
import { BitterFontLinks } from '../lib/brand-theme';

const tools = [
  { icon: PracticeIcon, title: 'Start Practice', body: 'பாடங்களைத் தேர்ந்தெடுத்து கேள்விகளுக்குப் பதில் அளிக்கலாம்.', href: '/quiz', iconColor: '#178D63' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', body: 'தேர்வு தொடர்பான சந்தேகங்களுக்கு விளக்கம் பெறலாம்.', href: '/ask-ponna', iconColor: '#2085C7' },
  { icon: MistakesIcon, title: 'Review Mistakes', body: 'தவறாகப் பதிலளித்த கேள்விகளை மீண்டும் பார்க்கலாம்.', href: '/mistakes', iconColor: '#D84C75' },
  { icon: StudyNotesIcon, title: 'Study Notes', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களைப் படிக்கலாம்.', href: '/study-notes', iconColor: '#C98A20' },
  { icon: DailyQuizIcon, title: 'Daily Challenge', body: 'Current Affairs மற்றும் Brain Challenge என இரண்டு தினசரி பயிற்சிகளைப் பெறலாம்.', href: '/daily-quiz', iconColor: '#7651B8' },
  { icon: LiveExamIcon, title: 'Live Exam', body: 'தேர்வு போன்ற சூழலில் தேர்வு எழுதலாம்.', href: '/tnpsc-group-4/online-test', iconColor: '#D8455C' },
  { icon: SubjectPreferenceIcon, title: 'Adaptive Mock', body: 'உங்கள் பயிற்சிக்கேற்ப மாதிரித் தேர்வு வழங்கப்படும்.', href: '/adaptive-mock', iconColor: '#2387C6' },
  { icon: ProgressIcon, title: 'Performance', body: 'உங்கள் மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்.', href: '/dashboard', iconColor: '#23956B' },
];

export default function HomeDesignPreview() {
  return (
    <main className="home-preview">
      <BitterFontLinks />

      <header className="site-header">
        <button className="menu-button" aria-label="மெனு"><span /><span /><span /></button>
        <a href="/" className="brand"><Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ width: 150, height: 'auto', display: 'block' }} /></a>
        <a href="/" className="login">உள்நுழைவு</a>
      </header>

      <section className="hero">
        <div className="hero-image-wrap">
          <Image
            src="/ponna-hero-woman.jpg"
            alt="PONNA தேர்வுக்குத் தயாராகும் மாணவி"
            width={227}
            height={250}
            priority
            className="hero-image"
          />
        </div>
        <div className="hero-copy">
          <div className="eyebrow">TNPSC தேர்வுக்கான பயிற்சி</div>
          <h1>Group 4 தேர்வுக்கு <em>திட்டமிட்டுப் பயிற்சி</em> செய்யுங்கள்</h1>
          <ul>
            <li>பாடவாரியாகப் பயிற்சி</li>
            <li>மாதிரித் தேர்வுகள்</li>
            <li>முன்னேற்றத்தைப் பார்க்கலாம்</li>
          </ul>
          <a href="/quiz" className="primary-button">இப்போதே பயிற்சியைத் தொடங்குங்கள் <b>→</b></a>
        </div>
      </section>

      <section className="content">
        <h2>தேர்வுக்குத் தேவையான வசதிகள்</h2>

        <a href="/current-affairs" className="wide-card current">
          <span className="wide-icon"><StudyNotesIcon size={26} color="#0B3864" /></span>
          <span><strong>Current Affairs</strong><small>தேர்வுக்குத் தேவையான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படிக்கலாம்.</small></span>
          <mark>புதியது</mark>
        </a>

        <a href="/tnpsc-group-4/notification-2026" className="notice-banner">
          <div className="notice-mark">4</div>
          <div className="notice-text">
            <strong>TNPSC Group 4 <span>2026 அறிவிப்பு</span></strong>
            <p>காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளலாம்.</p>
            <b>முழு விவரங்கள் →</b>
          </div>
        </a>

        <div className="tools-grid">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.title} href={item.href} className="tool-card">
                <div className="tool-top">
                  <span className="tool-icon"><Icon size={24} color={item.iconColor} /></span>
                  <strong>{item.title}</strong>
                  <span className="tool-arrow">›</span>
                </div>
                <p>{item.body}</p>
              </a>
            );
          })}
        </div>

        <a href="/cutoff-predictor" className="wide-card cutoff">
          <span className="wide-icon"><CutoffPredictorIcon size={26} color="#17835E" /></span>
          <span><strong>Cut-off Predictor</strong><small>உங்கள் மதிப்பெண் அடிப்படையில் கட்-ஆஃப் கணிப்பைப் பார்க்கலாம்.</small></span>
        </a>

        <section className="final-strip">
          <h3>தேர்வுப் பயிற்சியைத் தொடங்குங்கள்</h3>
          <p>உங்களுக்குத் தேவையான பயிற்சி வசதிகள் அனைத்தும் ஒரே இடத்தில்.</p>
          <a href="/quiz">பயிற்சியைத் தொடங்குங்கள் →</a>
        </section>
      </section>

      <footer>வடிவமைப்பு முன்னோட்டம் · PONNA.in</footer>

      <style jsx>{`
        .home-preview { width: 100%; max-width: 620px; margin: 0 auto; min-height: 100dvh; background: #fff; color: #20384D; font-family: 'Noto Sans Tamil', 'Nirmala UI', Latha, Arial, sans-serif; -webkit-text-size-adjust: 100%; }
        .site-header { height: 66px; background: #fff; border-bottom: 1px solid #DDE5E9; display: flex; align-items: center; padding: 0 14px; gap: 12px; position: sticky; top: 0; z-index: 30; }
        .menu-button { width: 44px; height: 44px; border: 0; background: transparent; display: grid; align-content: center; gap: 6px; padding: 8px; }
        .menu-button span { display: block; height: 3px; width: 28px; background: #0B3864; border-radius: 2px; }
        .brand { flex: 1; display: flex; align-items: center; }
        .login { background: #0B3864; color: #fff; text-decoration: none; border-radius: 24px; padding: 12px 18px; font-weight: 800; font-size: 16px; white-space: nowrap; min-height: 20px; }
        .hero { position: relative; background: #F1FAF3; border-bottom: 1px solid #DCE9DF; }
        .hero-image-wrap { height: 250px; background: #F1FAF3; overflow: hidden; display: flex; justify-content: flex-end; }
        .hero-image { width: 100%; height: 250px; object-fit: cover; object-position: center; display: block; }
        .hero-copy { padding: 22px 18px 26px; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 16px; margin-bottom: 8px; }
        h1 { margin: 0; color: #0B3864; font-size: 31px; line-height: 1.4; }
        h1 em { color: #E3313D; font-style: normal; }
        .hero ul { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 8px; font-size: 18px; font-weight: 700; line-height: 1.5; }
        .hero li::before { content: '✓'; color: #17835E; margin-right: 8px; font-weight: 900; }
        .primary-button { display: flex; align-items: center; justify-content: center; gap: 8px; background: #FFD22A; color: #20384D; text-decoration: none; font-weight: 900; border-radius: 12px; padding: 14px 16px; min-height: 52px; font-size: 18px; line-height: 1.4; margin-top: 20px; text-align: center; }
        .content { padding: 22px 14px 0; }
        .content h2 { text-align: center; color: #0B3864; font-size: 23px; line-height: 1.4; margin: 0 0 14px; }
        .content h2::after { content: ''; display: block; width: 52px; height: 3px; background: #D7E2E6; margin: 8px auto 0; border-radius: 2px; }
        .wide-card { display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 14px; margin-top: 10px; border: 1px solid #DDE5E9; border-radius: 12px; text-decoration: none; }
        .current { background: #F3F8FC; }
        .cutoff { background: #FFF8EA; margin-bottom: 4px; }
        .wide-icon { width: 46px; height: 46px; flex: 0 0 46px; background: #fff; border-radius: 10px; display: grid; place-items: center; }
        .wide-card > span:nth-child(2) { flex: 1; min-width: 0; }
        .wide-card strong { display: block; color: #0B3864; font-size: 18px; line-height: 1.4; }
        .wide-card small { display: block; color: #4F6272; font-size: 15px; line-height: 1.6; margin-top: 2px; }
        .wide-card mark { color: #E3313D; background: #fff; border-radius: 6px; padding: 5px 8px; font-size: 14px; font-weight: 800; }
        .notice-banner { margin: 10px 0 14px; border: 1px solid #CFE5D8; border-radius: 12px; background: #EFF9F1; display: flex; align-items: center; gap: 14px; padding: 14px; text-decoration: none; }
        .notice-mark { width: 48px; flex: 0 0 48px; align-self: stretch; border-right: 1px solid #BFD7C6; display: grid; place-items: center; color: #0B3864; font-size: 38px; font-weight: 900; }
        .notice-text { flex: 1; min-width: 0; }
        .notice-banner strong { color: #0B3864; font-size: 20px; line-height: 1.4; display: block; }
        .notice-banner strong span { color: #E3313D; }
        .notice-banner p { color: #4F6272; font-size: 15px; margin: 4px 0 10px; line-height: 1.6; }
        .notice-banner b { display: inline-block; color: #fff; background: #17835E; border-radius: 8px; padding: 10px 14px; font-size: 16px; line-height: 1.3; }
        .tools-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .tool-card { border: 1px solid #DDE5E9; border-radius: 12px; padding: 14px; text-decoration: none; background: #fff; display: block; }
        .tool-top { display: flex; align-items: center; gap: 12px; }
        .tool-icon { width: 46px; height: 46px; background: #F4F7F8; border-radius: 10px; display: grid; place-items: center; flex: 0 0 46px; }
        .tool-top strong { color: #0B3864; font-size: 19px; line-height: 1.35; flex: 1; }
        .tool-arrow { color: #667786; font-size: 28px; line-height: 1; }
        .tool-card p { color: #4F6272; font-size: 15.5px; line-height: 1.65; margin: 8px 0 0 58px; }
        .final-strip { margin: 14px 0 18px; padding: 22px 18px; border-radius: 12px; background: #0B3864; color: #fff; }
        .final-strip h3 { margin: 0; font-size: 23px; line-height: 1.4; }
        .final-strip p { margin: 8px 0 0; font-size: 16px; line-height: 1.6; opacity: .95; }
        .final-strip a { display: flex; align-items: center; justify-content: center; background: #FFD22A; color: #20384D; text-decoration: none; font-weight: 900; border-radius: 12px; padding: 14px 16px; min-height: 52px; font-size: 18px; margin-top: 16px; }
        footer { padding: 0 15px 26px; text-align: center; color: #667786; font-size: 14px; }
        @media (min-width: 621px) { .home-preview { box-shadow: 0 0 30px rgba(20,50,70,.08); } }
      `}</style>
    </main>
  );
}
