
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
  { icon: PracticeIcon, title: 'பயிற்சிக் கேள்விகள்', sub: 'தமிழில்', href: '/quiz', tone: '#EFF8FC', iconColor: '#1687D4' },
  { icon: AboutIcon, title: 'மாணவர்கள்', sub: 'நம்பிக்கையுடன்', href: '/about', tone: '#F5F0FC', iconColor: '#7752B9' },
  { icon: ProgressIcon, title: 'திறன் வளர்ப்பு', sub: 'முன்னேற்றம்', href: '/quiz', tone: '#EEF8F2', iconColor: '#21966A' },
  { icon: ProgressIcon, title: 'மாணவர் மதிப்பீடு', sub: 'தெளிவான முன்னேற்றம்', href: '/profile', tone: '#FFF1F4', iconColor: '#D94C70' },
];

const tools = [
  { icon: PracticeIcon, title: 'பயிற்சியைத் தொடங்குங்கள்', body: 'பாடங்களையும் கேள்விகளையும் தேர்ந்தெடுத்து பயிற்சி செய்யுங்கள்.', href: '/quiz', tone: '#F0FAF5', iconColor: '#178D63' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', body: 'தேர்வு தொடர்பான உங்கள் சந்தேகங்களுக்கு எளிய விளக்கங்களைப் பெறுங்கள்.', href: '/ask-ponna', tone: '#F1F8FD', iconColor: '#2085C7' },
  { icon: MistakesIcon, title: 'தவறுகளை மீண்டும் பயிற்சி செய்யுங்கள்', body: 'தவறாகப் பதிலளித்த கேள்விகளை மீண்டும் செய்து சரிசெய்யுங்கள்.', href: '/quiz', tone: '#FFF2F5', iconColor: '#D84C75' },
  { icon: StudyNotesIcon, title: 'படிப்புக் குறிப்புகள்', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களை எளிமையாகப் படியுங்கள்.', href: '/current-affairs', tone: '#FFF8E9', iconColor: '#C98A20' },
  { icon: DailyQuizIcon, title: 'தினசரி சவால்', body: 'தினமும் புதிய கேள்விகளுடன் உங்கள் அறிவையும் வேகத்தையும் சோதியுங்கள்.', href: '/daily-quiz', tone: '#F6F1FC', iconColor: '#7651B8' },
  { icon: LiveExamIcon, title: 'நேரடித் தேர்வு', body: 'தேர்வு போன்ற சூழலில் முழுமையான மாதிரித் தேர்வை எழுதி பயிற்சி பெறுங்கள்.', href: '/tnpsc-group-4/online-test', tone: '#FFF1F3', iconColor: '#D8455C' },
  { icon: SubjectPreferenceIcon, title: 'தனிப்பயன் மாதிரித் தேர்வு', body: 'உங்கள் திறனுக்கேற்ப பயிற்சியைத் தேர்ந்தெடுத்து செய்யுங்கள்.', href: '/quiz', tone: '#F0F8FD', iconColor: '#2387C6' },
  { icon: ProgressIcon, title: 'செயல்திறன்', body: 'உங்கள் முன்னேற்றம் மற்றும் மேம்படுத்த வேண்டிய பகுதிகளைப் பாருங்கள்.', href: '/profile', tone: '#EFF8F3', iconColor: '#23956B' },
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
          <div className="eyebrow">அரசுப் போட்டித் தேர்வுகளுக்கான பயிற்சித் தளம்</div>
          <h1>TNPSC Group 4<br />தேர்வுக்கான உங்கள்<br /><em>முழுமையான பயிற்சி</em><br />இங்கே தொடங்குகிறது!</h1>
          <ul>
            <li>புதிய பாடத்திட்டத்துக்கு ஏற்ப பயிற்சி</li>
            <li>தமிழில் எளிய விளக்கங்களுடன்</li>
            <li>உங்கள் முன்னேற்றத்தை நீங்களே அறிந்துகொள்ள</li>
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
        <h2>உங்கள் தேர்வுத் தயாரிப்புக்குத் தேவையான அனைத்தும்<br />ஒரே இடத்தில்</h2>

        <div className="tools-grid">
          {tools.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.title} href={item.href} className="tool-card" style={{ background: item.tone }}>
                <div className="tool-top">
                  <span className="tool-icon"><Icon size={20} color={item.iconColor} /></span>
                  <strong style={{ color: item.iconColor }}>{item.title}</strong>
                  <span className="tool-arrow">›</span>
                </div>
                <p>{item.body}</p>
              </a>
            );
          })}
        </div>

        <a href="/quiz" className="wide-card cutoff">
          <span className="wide-icon"><CutoffPredictorIcon size={22} color={C.green} /></span>
          <span><strong>கட்-ஆஃப் கணிப்பான்</strong><small>உங்கள் பயிற்சி மற்றும் தேர்வு முடிவுகளை அடிப்படையாகக் கொண்டு கட்-ஆஃப் மதிப்பெண்ணை கணிக்க உதவும்.</small></span>
          <b>›</b>
        </a>

        <a href="/current-affairs" className="wide-card current">
          <span className="wide-icon"><StudyNotesIcon size={22} color={C.navy} /></span>
          <span><strong>நடப்பு நிகழ்வுகள்</strong><small>போட்டித் தேர்வுகளுக்குத் தேவையான முக்கியமான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படியுங்கள்.</small></span>
          <mark>புதியது</mark>
        </a>

        <section className="tamil-strip">
          <div className="book-stack" aria-hidden="true"><span>தமிழ்</span><span>GENERAL STUDIES</span><span>APTITUDE</span></div>
          <div>
            <h3>தமிழில், எளிமையாக,<br />தேர்வு நோக்கில்!</h3>
            <p>அவசியமான பாடங்கள், பயிற்சிக் கேள்விகள், நடப்பு நிகழ்வுகள் — அனைத்தும் ஒரே இடத்தில்.</p>
            <a href="/quiz">பாடங்களைப் பார்க்க →</a>
          </div>
        </section>

        <section className="trust-strip">
          <div className="trust-quote">“</div>
          <p><strong>PONNA மாணவரை மதிப்பிடுவதற்காக மட்டும் அல்ல;<br />மாணவர் தனது திறனை அறிந்துகொள்வதற்கும் முன்னேறுவதற்கும் உதவுகிறது.</strong></p>
          <div className="steps"><span>பயிற்சி</span><i>→</i><span>முயற்சி</span><i>→</i><span>தவறுகளைச் சரிசெய்தல்</span><i>→</i><span>முன்னேற்றம்</span></div>
        </section>

        <section className="final-strip">
          <h3>உங்கள் தேர்வுத் தயாரிப்பு<br />இன்று தொடங்கட்டும்!</h3>
          <p>படிப்போம். பயிற்சி செய்வோம். தவறுகளைச் சரிசெய்வோம். முன்னேறுவோம்.</p>
          <a href="/quiz">இப்போதே பயிற்சியைத் தொடங்குங்கள் →</a>
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
        h1 { margin: 0; color: #0B3864; font-size: 27px; line-height: 1.17; letter-spacing: -.2px; }
        h1 em { color: #E3313D; font-style: normal; }
        .hero ul { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 5px; font-size: 10.5px; font-weight: 700; line-height: 1.35; }
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
        .content h2 { text-align: center; color: #0B3864; font-size: 19px; line-height: 1.3; margin: 0 0 12px; }
        .content h2::after { content: ''; display: block; width: 54px; height: 2px; background: #D8E4EA; margin: 8px auto 0; }
        .tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
        .tool-card { min-height: 105px; border: 1px solid #DDE5E9; border-radius: 8px; padding: 10px 10px 9px; text-decoration: none; }
        .tool-top { display: flex; align-items: center; gap: 7px; }
        .tool-icon { width: 34px; height: 34px; background: #fff; border-radius: 7px; display: grid; place-items: center; flex: 0 0 34px; }
        .tool-top strong { font-size: 11px; line-height: 1.18; flex: 1; }
        .tool-arrow { color: #667786; font-size: 20px; line-height: 1; }
        .tool-card p { color: #667786; font-size: 9.2px; line-height: 1.38; margin: 7px 0 0; }
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
