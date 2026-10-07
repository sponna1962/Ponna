'use client';

import Image from 'next/image';
import {
  PracticeIcon, ProgressIcon, AboutIcon, AskPonnaIcon, MistakesIcon,
  StudyNotesIcon, DailyQuizIcon, LiveExamIcon, SubjectPreferenceIcon,
  CutoffPredictorIcon,
} from '../components/icons';
import { BitterFontLinks } from '../lib/brand-theme';

const C = {
  navy: '#0B3864',
  green: '#16835E',
  yellow: '#FFD32A',
  red: '#E62D3A',
  ink: '#17324D',
  muted: '#5E7184',
  line: '#E1E8EC',
  white: '#FFFFFF',
  paper: '#F8FBFA',
};

const quick = [
  { icon: PracticeIcon, title: 'பயிற்சி கேள்விகள்', sub: 'தமிழில்', href: '/quiz', tone: '#E9F5FF', iconColor: '#1687D4' },
  { icon: AboutIcon, title: 'மாணவர்கள்', sub: 'நம்பிக்கையுடன்', href: '/about', tone: '#F2EBFF', iconColor: '#7C4DCE' },
  { icon: ProgressIcon, title: 'திறன் வளர்ப்பு', sub: 'முன்னேற்றம்', href: '/quiz', tone: '#E8F8EF', iconColor: '#19A56C' },
  { icon: ProgressIcon, title: 'மாணவர் மதிப்பீடு', sub: 'தெளிவான முன்னேற்றம்', href: '/profile', tone: '#FFEAF1', iconColor: '#E84D78' },
];

const tools = [
  { icon: PracticeIcon, title: 'பயிற்சியைத் தொடங்குங்கள்', body: 'பாடங்களையும் கேள்விகளையும் தேர்ந்தெடுத்து திட்டமிட்டுப் பயிற்சி செய்யுங்கள்.', href: '/quiz', tone: '#E7F8F0', iconColor: '#1E9A6A' },
  { icon: AskPonnaIcon, title: 'Ask PONNA', body: 'தேர்வு தொடர்பான உங்கள் சந்தேகங்களுக்கு எளிய விளக்கங்களைப் பெறுங்கள்.', href: '/ask-ponna', tone: '#E9F5FF', iconColor: '#1687D4' },
  { icon: MistakesIcon, title: 'தவறுகளை மீண்டும் பயிற்சி செய்யுங்கள்', body: 'தவறாகப் பதிலளித்த கேள்விகளை மீண்டும் செய்து, அதே தவறைத் தவிர்க்கப் பழகுங்கள்.', href: '/quiz', tone: '#FFEAF1', iconColor: '#E84D78' },
  { icon: StudyNotesIcon, title: 'படிப்புக் குறிப்புகள்', body: 'தேர்வுக்குத் தேவையான முக்கியப் பாடங்களை எளிமையாகவும் தெளிவாகவும் படியுங்கள்.', href: '/current-affairs', tone: '#FFF4D8', iconColor: '#D79623' },
  { icon: DailyQuizIcon, title: 'தினசரி சவால்', body: 'தினமும் புதிய கேள்விகளுடன் உங்கள் அறிவையும் வேகத்தையும் சோதியுங்கள்.', href: '/daily-quiz', tone: '#F2EBFF', iconColor: '#7C4DCE' },
  { icon: LiveExamIcon, title: 'நேரடித் தேர்வு', body: 'தேர்வு போன்ற சூழலில் முழுமையான மாதிரித் தேர்வை எழுதி பயிற்சி பெறுங்கள்.', href: '/tnpsc-group-4/online-test', tone: '#FFE9EE', iconColor: '#E83F58' },
  { icon: SubjectPreferenceIcon, title: 'தனிப்பயன் மாதிரித் தேர்வு', body: 'உங்கள் திறனுக்கேற்ப கேள்விகளின் கடினத்தன்மை மாறும் வகையில் பயிற்சி செய்யுங்கள்.', href: '/quiz', tone: '#E9F5FF', iconColor: '#1687D4' },
  { icon: ProgressIcon, title: 'செயல்திறன்', body: 'உங்கள் முன்னேற்றம், பலம், மேம்படுத்த வேண்டிய பகுதிகளைத் தெளிவாகப் பாருங்கள்.', href: '/profile', tone: '#E8F8EF', iconColor: '#19A56C' },
];

export default function HomeDesignPreview() {
  return (
    <main style={{ width: '100%', maxWidth: 620, margin: '0 auto', minHeight: '100dvh', background: C.paper, color: C.ink }}>
      <BitterFontLinks />

      <header style={{ height: 62, background: C.white, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-label="Menu" style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', color: C.navy, fontSize: 24 }}>☰</span>
          <Image src="/logo-wordmark.png" alt="PONNA.in" width={982} height={258} priority style={{ width: 144, height: 'auto' }} />
        </div>
        <a href="/" style={{ background: C.navy, color: C.white, textDecoration: 'none', borderRadius: 22, padding: '9px 16px', fontWeight: 800, fontSize: 13 }}>உள்நுழைவு</a>
      </header>

      <section style={{ position: 'relative', overflow: 'hidden', minHeight: 255, padding: '24px 22px 18px', background: 'linear-gradient(115deg,#EAFBF0 0%,#F7FFF9 58%,#DDF4E7 100%)' }}>
        <div style={{ position: 'relative', zIndex: 2, width: '61%' }}>
          <div style={{ color: C.green, fontSize: 12.5, fontWeight: 800, marginBottom: 8 }}>அரசுப் போட்டித் தேர்வுகளுக்கான நம்பகமான பயிற்சித் தளம்</div>
          <h1 style={{ margin: 0, color: C.navy, fontSize: 27, lineHeight: 1.22, fontWeight: 900 }}>
            TNPSC Group 4<br />
            தேர்வுக்கான உங்கள்<br />
            <span style={{ color: C.red }}>முழுமையான பயிற்சி</span><br />
            இங்கே தொடங்குகிறது!
          </h1>
          <div style={{ marginTop: 12, display: 'grid', gap: 5, fontSize: 11.5, fontWeight: 650, color: C.ink }}>
            <span>✓ புதிய பாடத்திட்டத்துக்கு ஏற்ப பயிற்சி</span>
            <span>✓ தமிழில் எளிய விளக்கங்களுடன்</span>
            <span>✓ உங்கள் முன்னேற்றத்தை நீங்களே அறிந்துகொள்ள</span>
          </div>
          <a href="/quiz" style={{ display: 'inline-block', marginTop: 13, background: C.yellow, color: C.ink, textDecoration: 'none', borderRadius: 22, padding: '10px 15px', fontWeight: 900, fontSize: 12, boxShadow: '0 5px 12px rgba(217,164,0,.18)' }}>
            இப்போதே பயிற்சியைத் தொடங்குங்கள் →
          </a>
        </div>
        <Image src="/ponna-hero-woman.jpg" alt="PONNA மாணவி" width={227} height={250} priority style={{ position: 'absolute', right: 0, bottom: 0, width: '48%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
      </section>

      <div style={{ padding: '9px 10px 0', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
        {quick.map((item) => {
          const Icon = item.icon;
          return <a key={item.title} href={item.href} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 13, minHeight: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: C.navy, boxShadow: '0 2px 8px rgba(28,53,71,.04)' }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: item.tone, display: 'grid', placeItems: 'center', marginBottom: 5 }}><Icon size={18} color={item.iconColor} /></span>
            <strong style={{ fontSize: 11, textAlign: 'center' }}>{item.title}</strong>
            <span style={{ fontSize: 9.5, color: C.muted, textAlign: 'center' }}>{item.sub}</span>
          </a>;
        })}
      </div>

      <a href="/tnpsc-group-4/notification-2026" style={{ display: 'block', margin: '9px 12px 0', borderRadius: 15, overflow: 'hidden', border: '1px solid #CFE6D9', textDecoration: 'none' }}>
        <Image src="/ads/tnpsc-group4-banner.png" alt="TNPSC Group 4 2026 அறிவிப்பு" width={900} height={420} style={{ width: '100%', height: 'auto', display: 'block' }} />
      </a>

      <section style={{ padding: '16px 12px 0' }}>
        <h2 style={{ textAlign: 'center', color: C.navy, fontSize: 20, lineHeight: 1.35, margin: '0 0 13px', fontWeight: 900 }}>
          உங்கள் தேர்வுத் தயாரிப்புக்குத் தேவையான அனைத்தும்<br />ஒரே இடத்தில்
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          {tools.map((item) => {
            const Icon = item.icon;
            return <a key={item.title} href={item.href} style={{ minHeight: 112, background: item.tone, border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 12px', textDecoration: 'none', color: C.ink }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: C.white, display: 'grid', placeItems: 'center' }}><Icon size={19} color={item.iconColor} /></span>
                <strong style={{ color: item.iconColor, fontSize: 12.2, lineHeight: 1.25 }}>{item.title}</strong>
              </div>
              <p style={{ margin: 0, color: C.muted, fontSize: 10.3, lineHeight: 1.45 }}>{item.body}</p>
            </a>;
          })}
        </div>

        <a href="/quiz" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, background: '#FFF1D8', border: `1px solid ${C.line}`, borderRadius: 14, padding: '13px 14px', textDecoration: 'none', color: C.ink }}>
          <span style={{ width: 38, height: 38, borderRadius: 10, background: C.white, display: 'grid', placeItems: 'center' }}><CutoffPredictorIcon size={21} color={C.green} /></span>
          <span><strong style={{ display: 'block', color: C.navy, fontSize: 13 }}>கட்-ஆஃப் கணிப்பான்</strong><span style={{ display: 'block', color: C.muted, fontSize: 10.3, marginTop: 2 }}>உங்கள் பயிற்சி மற்றும் தேர்வு முடிவுகளை அடிப்படையாகக் கொண்டு கட்-ஆஃப் மதிப்பெண்ணை கணிக்க உதவும்.</span></span>
          <span style={{ marginLeft: 'auto', fontSize: 20, color: C.muted }}>›</span>
        </a>

        <a href="/current-affairs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9, minHeight: 74, background: '#EAF4FB', border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 13px', textDecoration: 'none' }}>
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: C.white, display: 'grid', placeItems: 'center' }}><StudyNotesIcon size={21} color={C.navy} /></span>
            <span><strong style={{ display: 'block', color: C.navy, fontSize: 13 }}>நடப்பு நிகழ்வுகள்</strong><span style={{ color: C.muted, fontSize: 10.3 }}>போட்டித் தேர்வுகளுக்குத் தேவையான முக்கியமான நடப்பு நிகழ்வுகளைத் தொடர்ந்து படியுங்கள்.</span></span>
          </span>
          <b style={{ color: C.red, fontSize: 9, background: C.white, borderRadius: 10, padding: '3px 6px' }}>புதியது</b>
        </a>

        <div style={{ marginTop: 9, borderRadius: 15, padding: '17px 16px', background: 'linear-gradient(110deg,#E7F7EA,#F7FCEB)', border: '1px solid #D9EAD9', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.white, display: 'grid', placeItems: 'center', flexShrink: 0 }}><PracticeIcon size={28} color={C.green} /></div>
          <div><strong style={{ display: 'block', color: C.navy, fontSize: 19 }}>தமிழில், எளிமையாக,<br />தேர்வு நோக்கில்!</strong><span style={{ display: 'block', marginTop: 5, color: C.muted, fontSize: 10.3 }}>அவசியமான பாடங்கள், பயிற்சிக் கேள்விகள், நடப்பு நிகழ்வுகள் — அனைத்தும் ஒரே இடத்தில்.</span><a href="/quiz" style={{ display: 'inline-block', marginTop: 9, background: C.yellow, color: C.ink, padding: '8px 13px', borderRadius: 18, fontWeight: 800, fontSize: 10.5, textDecoration: 'none' }}>பாடங்களைப் பார்க்க →</a></div>
        </div>

        <div style={{ marginTop: 9, background: C.white, borderRadius: 15, border: `1px solid ${C.line}`, padding: '15px 14px', textAlign: 'center' }}>
          <div style={{ color: C.yellow, fontSize: 24, marginBottom: 3 }}>“</div>
          <strong style={{ color: C.navy, fontSize: 13, lineHeight: 1.45 }}>PONNA மாணவரை மதிப்பிடுவதற்காக மட்டும் அல்ல;<br />மாணவர் தனது திறனை அறிந்துகொள்வதற்கும் முன்னேறுவதற்கும் உதவுகிறது.</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 13, fontSize: 9.5, color: C.muted }}>
            <span>பயிற்சி</span><span>முயற்சி</span><span>தவறுகளைச் சரிசெய்தல்</span><span>முன்னேற்றம்</span>
          </div>
        </div>

        <div style={{ margin: '9px 0 16px', borderRadius: 15, padding: '18px 16px', background: 'linear-gradient(135deg,#0A5B67,#167A63)', color: C.white, position: 'relative', overflow: 'hidden' }}>
          <strong style={{ display: 'block', fontSize: 20, lineHeight: 1.3 }}>உங்கள் தேர்வுத் தயாரிப்பு<br />இன்று தொடங்கட்டும்!</strong>
          <span style={{ display: 'block', marginTop: 5, fontSize: 10.5, opacity: .9 }}>படிப்போம். பயிற்சி செய்வோம். தவறுகளைச் சரிசெய்வோம். முன்னேறுவோம்.</span>
          <a href="/quiz" style={{ display: 'inline-block', marginTop: 10, background: C.yellow, color: C.ink, borderRadius: 20, padding: '9px 15px', fontWeight: 900, fontSize: 11, textDecoration: 'none' }}>இப்போதே பயிற்சியைத் தொடங்குங்கள் →</a>
          <div style={{ position: 'absolute', right: -15, bottom: -28, width: 145, height: 145, borderRadius: '50%', background: 'rgba(255,211,42,.18)' }} />
        </div>
      </section>

      <footer style={{ padding: '0 16px 22px', textAlign: 'center', color: C.muted, fontSize: 10.5 }}>
        வடிவமைப்பு முன்னோட்டம் · PONNA.in
      </footer>
    </main>
  );
}
