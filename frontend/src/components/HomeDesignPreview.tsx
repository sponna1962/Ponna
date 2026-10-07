
'use client';

import Image from 'next/image';
import {
  PracticeIcon, ProgressIcon, AboutIcon, AskPonnaIcon, MistakesIcon,
  StudyNotesIcon, DailyQuizIcon, LiveExamIcon, SubjectPreferenceIcon,
  CutoffPredictorIcon,
} from '../components/icons';
import { BitterFontLinks } from '../lib/brand-theme';

const C = {"navy":"#0B3864","green":"#17835E","yellow":"#FFD22A","red":"#E3313D","ink":"#20384D","muted":"#667786","line":"#DDE5E9","paper":"#FFFFFF"};

const quick = [
  { icon: PracticeIcon, title: 'Start Practice', sub: 'கேள்விகளைப் பயிற்சி செய்யலாம்', href: '/quiz', tone: '#EFF8FC', iconColor: '#1687D4' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', sub: 'சந்தேகங்களுக்கு விளக்கம் பெறலாம்', href: '/about', tone: '#F5F0FC', iconColor: '#7752B9' },
  { icon: MistakesIcon, title: 'Review Mistakes', sub: 'தவறான கேள்விகளை மீண்டும் பார்க்கலாம்', href: '/quiz', tone: '#EEF8F2', iconColor: '#21966A' },
  { icon: ProgressIcon, title: 'Performance', sub: 'மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்', href: '/profile', tone: '#FFF1F4', iconColor: '#D94C70' },
];

const tools = [
  { icon: PracticeIcon, title: 'Start Practice', body: 'பாடங்களைத் தேர்ந்தெடுத்து கேள்விகளுக்குப் பதில் அளிக்கலாம்.', href: '/quiz', tone: '#F0FAF5', iconColor: '#178D63' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', body: 'தேர்வு தொடர்பான சந்தேகங்களுக்கு விளக்கம் பெறலாம்.', href: '/ask-ponna', tone: '#F1F8FD', iconColor: '#2085C7' },
  { icon: MistakesIcon, title: 'Review Mistakes', body: 'தவறாகப் பதிலளித்த கேள்விகளை மீண்டும் பார்க்கலாம்.', href: '/quiz', tone: '#FFF2F5', iconColor: '#D84C75' },
  { icon: StudyNotesIcon, title: 'Study Notes', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களைப் படிக்கலாம்.', href: '/study-notes', tone: '#FFF8E9', iconColor: '#C98A20' },
  { icon: DailyQuizIcon, title: 'Daily Challenge', body: 'Current Affairs மற்றும் Brain Challenge என இரண்டு தினசரி பயிற்சிகளைப் பெறலாம்.', href: '/daily-quiz', tone: '#F6F1FC', iconColor: '#7651B8' },
  { icon: LiveExamIcon, title: 'Live Exam', body: 'தேர்வு போன்ற சூழலில் தேர்வு எழுதலாம்.', href: '/tnpsc-group-4/online-test', tone: '#FFF1F3', iconColor: '#D8455C' },
  { icon: SubjectPreferenceIcon, title: 'Adaptive Mock', body: 'உங்கள் பயிற்சிக்கேற்ப மாதிரித் தேர்வு வழங்கப்படும்.', href: '/adaptive-mock', tone: '#F0F8FD', iconColor: '#2387C6' },
  { icon: ProgressIcon, title: 'Performance', body: 'உங்கள் மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்.', href: '/dashboard', tone: '#EFF8F3', iconColor: '#23956B' },
];

export default function HomeDesignPreview() {
  return (
    <main className="home-preview">
      <BitterFontLinks />

      <header className="site-header">
        <button className="menu-button" aria-label="மெனு"><span /><span /><span /></button>
        <a href="/" className="brand" style={{ flex: 1, display: 'flex', alignItems: 'center' }}><Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ width: 145, height: 'auto', display: 'block' }} /></a>
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
          <Image src="/ponna-hero-woman.jpg" alt="பயிலும் மாணவி" width={227} height={250} priority sizes="(max-width: 620px) 48vw, 300px" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        </div>
      </section>

      <div className="quick-row">
        {quick.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.title} href={item.href} className="quick-card">
              <span className="quick-icon" style={{ background: item.tone }}>
                <Icon size={20} color={item.iconColor} />
              </span>
              <strong>{item.title}</strong>
              <small>{item.sub}</small>
            </a>
          );
        })}
      </div>

      <a href="/tnpsc-group-4/notification-2026" className="notice-banner">
        <div className="notice-mark">4</div>
        <div>
          <strong>TNPSC Group 4 <span>2026 அறிவிப்பு</span></strong>
          <p>காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளுங்கள்.</p>
          <b>முழு விவரங்களைப் பார்க்க →</b>
        </div>
        <span className="notice-arrow">›</span>
      </a>

      <section className="content">
        <h2>தேர்வுக்குத் தேவையான வசதிகள்</h2>

        <a href="/current-affairs" className="wide-card current">
          <span className="wide-icon"><StudyNotesIcon size={22} color="#0B3864" /></span>
          <span><strong>Current Affairs</strong><small>தேர்வுக்குத் தேவையான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படிக்கலாம்.</small></span>
          <mark>புதியது</mark>
        </a>

        <a href="/tnpsc-group-4/notification-2026" className="notice-banner inline-notice">
          <div className="notice-mark">4</div>
          <div>
            <strong>TNPSC Group 4 <span>2026 அறிவிப்பு</span></strong>
            <p>காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளலாம்.</p>
            <b>முழு விவரங்கள் →</b>
          </div>
          <span className="notice-arrow">›</span>
        </a>

        <div className="tools-grid">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.title} href={item.href} className="tool-card" style={{ '--tone': item.tone, '--icon': item.iconColor } as React.CSSProperties}>
                <div className="tool-top">
                  <span className="tool-icon"><Icon size={19} color={item.iconColor} /></span>
                  <strong>{item.title}</strong>
                  <span className="tool-arrow">›</span>
                </div>
                <p>{item.body}</p>
              </a>
            );
          })}
        </div>

        <a href="/cutoff-predictor" className="wide-card cutoff">
          <span className="wide-icon"><CutoffPredictorIcon size={22} color="#17835E" /></span>
          <span><strong>Cut-off Predictor</strong><small>உங்கள் மதிப்பெண் அடிப்படையில் கட்-ஆஃப் கணிப்பைப் பார்க்கலாம்.</small></span>
          <b>›</b>
        </a>

        <section className="final-strip">
          <h3>தேர்வுப் பயிற்சியைத் தொடங்குங்கள்</h3>
          <p>உங்களுக்குத் தேவையான பயிற்சி வசதிகள் அனைத்தும் ஒரே இடத்தில்.</p>
          <a href="/quiz">Start Practice →</a>
        </section>
      </section>

      <footer>வடிவமைப்பு முன்னோட்டம் · PONNA.in</footer>

      <style jsx>{`
        .home-preview { width: 100%; max-width: 620px; margin: 0 auto; min-height: 100dvh; background: #fff; color: #20384D; font-family: Arial, sans-serif; }
        .site-header { height: 62px; background: #fff; border-bottom: 1px solid #DDE5E9; display: flex; align-items: center; padding: 0 14px; gap: 12px; position: sticky; top: 0; z-index: 30; }
        .menu-button { width: 34px; height: 34px; border: 0; background: transparent; display: grid; align-content: center; gap: 5px; padding: 4px; }
        .menu-button span { display: block; height: 2px; width: 27px; background: #0B3864; }
        .brand { flex: 1; display: flex; align-items: center; }
        .login { background: #0B3864; color: #fff; text-decoration: none; border-radius: 20px; padding: 9px 16px; font-weight: 800; font-size: 13px; white-space: nowrap; }
        .hero { min-height: 258px; display: flex; position: relative; overflow: hidden; background: #F1FAF3; border-bottom: 1px solid #DCE9DF; }
        .hero-copy { width: 57%; padding: 20px 4px 18px 20px; position: relative; z-index: 2; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 11px; margin-bottom: 6px; }
        h1 { margin: 0; color: #0B3864; font-size: 25px; line-height: 1.16; letter-spacing: -.2px; }
        h1 em { color: #E3313D; font-style: normal; }
        .hero ul { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 4px; font-size: 10px; font-weight: 700; line-height: 1.3; }
        .hero li::before { content: '✓'; color: #17835E; margin-right: 5px; font-weight: 900; }
        .primary-button { display: inline-block; background: #FFD22A; color: #20384D; text-decoration: none; font-weight: 900; border-radius: 6px; padding: 9px 12px; font-size: 10.5px; margin-top: 12px; }
        .hero-photo { position: absolute; top: 0; right: 0; bottom: 0; width: 47%; overflow: hidden; }
        .quick-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; padding: 8px 10px 0; }
        .quick-card { min-height: 72px; padding: 7px 4px; background: #fff; border: 1px solid #DDE5E9; border-radius: 9px; text-decoration: none; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .quick-icon { width: 31px; height: 31px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 4px; }
        .quick-card strong { color: #0B3864; font-size: 9.7px; line-height: 1.15; }
        .quick-card small { color: #667786; font-size: 8px; margin-top: 2px; line-height: 1.15; }
        .content { padding: 16px 12px 0; }
        .content h2 { text-align: center; color: #0B3864; font-size: 19px; line-height: 1.25; margin: 0 0 11px; }
        .content h2::after { content: ''; display: block; width: 45px; height: 2px; background: #D7E2E6; margin: 7px auto 0; }
        .wide-card { display: flex; align-items: center; gap: 9px; min-height: 67px; padding: 9px 11px; margin-top: 7px; border: 1px solid #DDE5E9; border-radius: 9px; text-decoration: none; }
        .current { background: #F3F8FC; }
        .cutoff { background: #FFF8EA; }
        .wide-icon { width: 36px; height: 36px; flex: 0 0 36px; background: #fff; border-radius: 8px; display: grid; place-items: center; }
        .wide-card > span:nth-child(2) { flex: 1; }
        .wide-card strong { display: block; color: #0B3864; font-size: 12px; }
        .wide-card small { display: block; color: #667786; font-size: 8.9px; line-height: 1.35; margin-top: 2px; }
        .wide-card > b { color: #667786; font-size: 21px; }
        .wide-card mark { color: #E3313D; background: #fff; border-radius: 4px; padding: 3px 5px; font-size: 8px; font-weight: 800; }
        .notice-banner { margin: 7px 0 11px; min-height: 76px; border: 1px solid #CFE5D8; border-radius: 9px; background: #EFF9F1; display: flex; align-items: center; gap: 10px; padding: 9px 11px; text-decoration: none; position: relative; }
        .notice-mark { width: 43px; height: 48px; flex: 0 0 43px; border-right: 1px solid #BFD7C6; display: grid; place-items: center; color: #0B3864; font-size: 31px; font-weight: 900; }
        .notice-banner strong { color: #0B3864; font-size: 17px; }
        .notice-banner strong span { color: #E3313D; }
        .notice-banner p { color: #667786; font-size: 8.8px; margin: 3px 0 6px; line-height: 1.3; }
        .notice-banner b { color: #fff; background: #17835E; border-radius: 4px; padding: 5px 8px; font-size: 8.5px; }
        .notice-arrow { margin-left: auto; color: #0B3864; font-size: 25px; }
        .tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
        .tool-card { min-height: 91px; border: 1px solid #DDE5E9; border-left: 3px solid var(--icon); border-radius: 8px; padding: 9px 9px 8px; text-decoration: none; background: #fff; }
        .tool-top { display: flex; align-items: center; gap: 7px; }
        .tool-icon { width: 32px; height: 32px; background: var(--tone); border-radius: 7px; display: grid; place-items: center; flex: 0 0 32px; }
        .tool-top strong { color: #0B3864; font-size: 10.8px; line-height: 1.18; flex: 1; }
        .tool-arrow { color: #667786; font-size: 20px; line-height: 1; }
        .tool-card p { color: #667786; font-size: 8.7px; line-height: 1.38; margin: 7px 0 0; }
        .final-strip { margin: 9px 0 15px; padding: 15px 14px; border-radius: 9px; background: #0B3864; color: #fff; }
        .final-strip h3 { margin: 0; font-size: 19px; line-height: 1.2; }
        .final-strip p { margin: 4px 0 0; font-size: 9px; opacity: .9; }
        .final-strip a { display: inline-block; background: #FFD22A; color: #20384D; text-decoration: none; font-weight: 900; border-radius: 5px; padding: 8px 10px; font-size: 9.5px; margin-top: 9px; }
        footer { padding: 0 15px 20px; text-align: center; color: #667786; font-size: 9px; }
        @media (min-width: 621px) { .home-preview { box-shadow: 0 0 30px rgba(20,50,70,.08); } }
      `}</style>

import Image from 'next/image';
import {
  PracticeIcon, ProgressIcon, AboutIcon, AskPonnaIcon, MistakesIcon,
  StudyNotesIcon, DailyQuizIcon, LiveExamIcon, SubjectPreferenceIcon,
  CutoffPredictorIcon,
} from '../components/icons';
import { BitterFontLinks } from '../lib/brand-theme';

const C = {"navy":"#0B3864","green":"#17835E","yellow":"#FFD22A","red":"#E3313D","ink":"#20384D","muted":"#667786","line":"#DDE5E9","paper":"#FFFFFF"};

const quick = [
  { icon: PracticeIcon, title: 'Start Practice', sub: 'கேள்விகளைப் பயிற்சி செய்யலாம்', href: '/quiz', tone: '#EFF8FC', iconColor: '#1687D4' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', sub: 'சந்தேகங்களுக்கு விளக்கம் பெறலாம்', href: '/about', tone: '#F5F0FC', iconColor: '#7752B9' },
  { icon: MistakesIcon, title: 'Review Mistakes', sub: 'தவறான கேள்விகளை மீண்டும் பார்க்கலாம்', href: '/quiz', tone: '#EEF8F2', iconColor: '#21966A' },
  { icon: ProgressIcon, title: 'Performance', sub: 'மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்', href: '/profile', tone: '#FFF1F4', iconColor: '#D94C70' },
];

const tools = [
  { icon: PracticeIcon, title: 'Start Practice', body: 'பாடங்களைத் தேர்ந்தெடுத்து கேள்விகளுக்குப் பதில் அளிக்கலாம்.', href: '/quiz', tone: '#F0FAF5', iconColor: '#178D63' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', body: 'தேர்வு தொடர்பான சந்தேகங்களுக்கு விளக்கம் பெறலாம்.', href: '/ask-ponna', tone: '#F1F8FD', iconColor: '#2085C7' },
  { icon: MistakesIcon, title: 'Review Mistakes', body: 'தவறாகப் பதிலளித்த கேள்விகளை மீண்டும் பார்க்கலாம்.', href: '/quiz', tone: '#FFF2F5', iconColor: '#D84C75' },
  { icon: StudyNotesIcon, title: 'Study Notes', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களைப் படிக்கலாம்.', href: '/study-notes', tone: '#FFF8E9', iconColor: '#C98A20' },
  { icon: DailyQuizIcon, title: 'Daily Challenge', body: 'Current Affairs மற்றும் Brain Challenge என இரண்டு தினசரி பயிற்சிகளைப் பெறலாம்.', href: '/daily-quiz', tone: '#F6F1FC', iconColor: '#7651B8' },
  { icon: LiveExamIcon, title: 'Live Exam', body: 'தேர்வு போன்ற சூழலில் தேர்வு எழுதலாம்.', href: '/tnpsc-group-4/online-test', tone: '#FFF1F3', iconColor: '#D8455C' },
  { icon: SubjectPreferenceIcon, title: 'Adaptive Mock', body: 'உங்கள் பயிற்சிக்கேற்ப மாதிரித் தேர்வு வழங்கப்படும்.', href: '/adaptive-mock', tone: '#F0F8FD', iconColor: '#2387C6' },
  { icon: ProgressIcon, title: 'Performance', body: 'உங்கள் மதிப்பெண் மற்றும் முன்னேற்றத்தைப் பார்க்கலாம்.', href: '/dashboard', tone: '#EFF8F3', iconColor: '#23956B' },
];

export default function HomeDesignPreview() {
  return (
    <main className="home-preview">
      <BitterFontLinks />

      <header className="site-header">
        <button className="menu-button" aria-label="மெனு"><span /><span /><span /></button>
        <a href="/" className="brand" style={{ flex: 1, display: 'flex', alignItems: 'center' }}><Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ width: 145, height: 'auto', display: 'block' }} /></a>
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
          <Image src="/ponna-hero-woman.jpg" alt="பயிலும் மாணவி" width={227} height={250} priority sizes="(max-width: 620px) 48vw, 300px" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        </div>
      </section>

      <div className="quick-row">
        {quick.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.title} href={item.href} className="quick-card">
              <span className="quick-icon" style={{ background: item.tone }}>
                <Icon size={20} color={item.iconColor} />
              </span>
              <strong>{item.title}</strong>
              <small>{item.sub}</small>
            </a>
          );
        })}
      </div>

      <a href="/tnpsc-group-4/notification-2026" className="notice-banner">
        <div className="notice-mark">4</div>
        <div>
          <strong>TNPSC Group 4 <span>2026 அறிவிப்பு</span></strong>
          <p>காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளுங்கள்.</p>
          <b>முழு விவரங்களைப் பார்க்க →</b>
        </div>
        <span className="notice-arrow">›</span>
      </a>

      <section className="content">
        <h2>தேர்வுக்குத் தேவையான வசதிகள்</h2>

        <a href="/current-affairs" className="wide-card current">
          <span className="wide-icon"><StudyNotesIcon size={22} color="#0B3864" /></span>
          <span><strong>Current Affairs</strong><small>தேர்வுக்குத் தேவையான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படிக்கலாம்.</small></span>
          <mark>புதியது</mark>
        </a>

        <a href="/tnpsc-group-4/notification-2026" className="notice-banner inline-notice">
          <div className="notice-mark">4</div>
          <div>
            <strong>TNPSC Group 4 <span>2026 அறிவிப்பு</span></strong>
            <p>காலிப்பணியிடங்கள் மற்றும் முக்கியத் தகவல்களைத் தெரிந்துகொள்ளலாம்.</p>
            <b>முழு விவரங்கள் →</b>
          </div>
          <span className="notice-arrow">›</span>
        </a>

        <div className="tools-grid">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.title} href={item.href} className="tool-card" style={{ '--tone': item.tone, '--icon': item.iconColor } as React.CSSProperties}>
                <div className="tool-top">
                  <span className="tool-icon"><Icon size={19} color={item.iconColor} /></span>
                  <strong>{item.title}</strong>
                  <span className="tool-arrow">›</span>
                </div>
                <p>{item.body}</p>
              </a>
            );
          })}
        </div>

        <a href="/cutoff-predictor" className="wide-card cutoff">
          <span className="wide-icon"><CutoffPredictorIcon size={22} color="#17835E" /></span>
          <span><strong>Cut-off Predictor</strong><small>உங்கள் மதிப்பெண் அடிப்படையில் கட்-ஆஃப் கணிப்பைப் பார்க்கலாம்.</small></span>
          <b>›</b>
        </a>

        <section className="final-strip">
          <h3>தேர்வுப் பயிற்சியைத் தொடங்குங்கள்</h3>
          <p>உங்களுக்குத் தேவையான பயிற்சி வசதிகள் அனைத்தும் ஒரே இடத்தில்.</p>
          <a href="/quiz">Start Practice →</a>
        </section>
      </section>

      <footer>வடிவமைப்பு முன்னோட்டம் · PONNA.in</footer>

      <style jsx>{`
        .home-preview { width: 100%; max-width: 620px; margin: 0 auto; min-height: 100dvh; background: #FFFFFF; color: #20384D; font-family: Arial, sans-serif; }
        .site-header { height: 62px; background: #fff; border-bottom: 1px solid #DDE5E9; display: flex; align-items: center; padding: 0 14px; gap: 12px; position: sticky; top: 0; z-index: 30; }
        .menu-button { width: 34px; height: 34px; border: 0; background: transparent; display: grid; align-content: center; gap: 5px; padding: 4px; }
        .menu-button span { display: block; height: 2px; width: 28px; background: #0B3864; }
        .brand { flex: 1; display: flex; align-items: center; }
        .login { background: #0B3864; color: white; text-decoration: none; border-radius: 20px; padding: 9px 17px; font-weight: 800; font-size: 13px; white-space: nowrap; }
        .hero { min-height: 280px; display: flex; position: relative; overflow: hidden; background: linear-gradient(90deg,#F1FBF3 0%,#F8FFF9 58%,#E6F6EA 100%); }
        .hero-copy { width: 58%; padding: 22px 0 20px 22px; position: relative; z-index: 2; }
        .eyebrow { color: #17835E; font-weight: 800; font-size: 12px; margin-bottom: 6px; }
        h1 { margin: 0; color: #0B3864; font-size: 26px; line-height: 1.18; letter-spacing: -.2px; }
        h1 em { color: #E3313D; font-style: normal; }
        .hero ul { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 4px; font-size: 10px; font-weight: 700; line-height: 1.35; }
        .hero li::before { content: '✓'; color: #17835E; margin-right: 5px; font-weight: 900; }
        .primary-button, .tamil-strip a, .final-strip a { display: inline-block; background: #FFD22A; color: #20384D; text-decoration: none; font-weight: 900; border-radius: 5px; padding: 9px 13px; font-size: 10.5px; margin-top: 12px; }
        .primary-button b { margin-left: 5px; }
        .hero-photo { position: absolute; top: 0; right: 0; bottom: 0; width: 47%; }
                .quick-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; padding: 8px 10px 0; }
        .quick-card { min-height: 74px; padding: 8px 4px; background: #fff; border: 1px solid #DDE5E9; border-radius: 8px; text-decoration: none; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 1px 4px rgba(22,54,75,.04); }
        .quick-icon { width: 32px; height: 32px; border-radius: 8px; display: grid; place-items: center; margin-bottom: 4px; }
        .quick-card strong { color: #0B3864; font-size: 10.2px; line-height: 1.15; }
        .quick-card small { color: #667786; font-size: 8.7px; margin-top: 2px; }
        .notice-banner { margin: 8px 12px 0; min-height: 82px; border: 1px solid #CFE5D8; border-radius: 9px; background: #EFF9F1; display: flex; align-items: center; gap: 12px; padding: 10px 13px; text-decoration: none; position: relative; }
        .notice-mark { width: 46px; height: 52px; flex: 0 0 46px; border-right: 1px solid #BFD7C6; display: grid; place-items: center; color: #0B3864; font-size: 34px; font-weight: 900; }
        .notice-banner strong { color: #0B3864; font-size: 19px; }
        .notice-banner strong span { color: #E3313D; }
        .notice-banner p { color: #667786; font-size: 9.5px; margin: 3px 0 6px; }
        .notice-banner b { color: #fff; background: #17835E; border-radius: 4px; padding: 5px 8px; font-size: 9px; }
        .notice-arrow { margin-left: auto; color: #0B3864; font-size: 26px; }
        .content { padding: 14px 12px 0; }
        .content h2 { text-align: center; color: #0B3864; font-size: 18px; line-height: 1.3; margin: 0 0 12px; }
        .content h2::after { content: ''; display: block; width: 54px; height: 2px; background: #D8E4EA; margin: 8px auto 0; }
        .tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
        .tool-card { min-height: 92px; border: 1px solid #DDE5E9; border-radius: 8px; padding: 10px 10px 9px; text-decoration: none; }
        .tool-top { display: flex; align-items: center; gap: 7px; }
        .tool-icon { width: 34px; height: 34px; background: #fff; border-radius: 7px; display: grid; place-items: center; flex: 0 0 34px; }
        .tool-top strong { font-size: 11px; line-height: 1.18; flex: 1; }
        .tool-arrow { color: #667786; font-size: 20px; line-height: 1; }
        .tool-card p { color: #667786; font-size: 8.8px; line-height: 1.38; margin: 7px 0 0; }
        .wide-card { display: flex; align-items: center; gap: 9px; min-height: 67px; padding: 9px 11px; margin-top: 7px; border: 1px solid #DDE5E9; border-radius: 8px; text-decoration: none; }
        .cutoff { background: #FFF7E8; }
        .current { background: #EFF7FC; }
        .wide-icon { width: 35px; height: 35px; flex: 0 0 35px; background: #fff; border-radius: 7px; display: grid; place-items: center; }
        .wide-card > span:nth-child(2) { flex: 1; }
        .wide-card strong { display: block; color: #0B3864; font-size: 11.5px; }
        .wide-card small { display: block; color: #667786; font-size: 8.8px; line-height: 1.35; margin-top: 2px; }
        .wide-card > b { color: #667786; font-size: 21px; }
        .wide-card mark { color: #E3313D; background: #fff; border-radius: 4px; padding: 3px 5px; font-size: 8px; font-weight: 800; }
        .tamil-strip { margin-top: 8px; border: 1px solid #D8E9D9; border-radius: 9px; background: #F1FAF0; padding: 13px; display: flex; align-items: center; gap: 13px; }
        .book-stack { width: 102px; flex: 0 0 102px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
        .book-stack span { background: #fff; border: 1px solid #D7E1E4; padding: 3px 6px; font-size: 7px; font-weight: 900; color: #0B3864; box-shadow: 1px 1px 0 #C9D5D8; }
        .book-stack span:first-child { color: #E3313D; }
        .tamil-strip h3 { color: #0B3864; margin: 0; font-size: 18px; line-height: 1.15; }
        .tamil-strip p { color: #667786; font-size: 8.9px; line-height: 1.4; margin: 4px 0 0; }
        .tamil-strip a { padding: 7px 10px; margin-top: 7px; font-size: 9px; }
        .trust-strip { margin-top: 8px; padding: 13px 12px 11px; border: 1px solid #DDE5E9; border-radius: 9px; background: #fff; text-align: center; }
        .trust-quote { color: #FFD22A; font-size: 22px; line-height: .7; }
        .trust-strip p { color: #0B3864; font-size: 10.8px; line-height: 1.45; margin: 5px 0 10px; }
        .steps { display: flex; justify-content: space-between; align-items: center; color: #667786; font-size: 8px; gap: 4px; }
        .steps i { font-style: normal; color: #A8B5BD; }
        .final-strip { margin: 8px 0 15px; padding: 15px 14px; border-radius: 9px; background: linear-gradient(115deg,#0B6670,#2D805E); color: #fff; position: relative; overflow: hidden; }
        .final-strip::after { content: ''; position: absolute; width: 150px; height: 150px; right: -55px; bottom: -80px; border-radius: 50%; background: rgba(255,210,42,.15); }
        .final-strip h3 { margin: 0; font-size: 20px; line-height: 1.25; position: relative; z-index: 1; }
        .final-strip p { margin: 4px 0 0; font-size: 9px; opacity: .9; position: relative; z-index: 1; }
        .final-strip a { position: relative; z-index: 1; padding: 8px 11px; margin-top: 9px; }
        footer { padding: 0 15px 20px; text-align: center; color: #667786; font-size: 9px; }
        @media (min-width: 621px) { .home-preview { box-shadow: 0 0 30px rgba(20,50,70,.08); } }
      `}
      </style>
    </main>
  );
}
