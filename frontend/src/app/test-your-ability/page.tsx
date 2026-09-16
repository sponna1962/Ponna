'use client';

// Welcome Screen (Sept 2026, Item 4 — First-Visit TNPSC Group 4
// Diagnostic Flow). Redesigned per an explicit reference mockup: light/
// white ground with navy ink and a gold accent -- the familiar,
// credible visual language of established government-exam-prep
// platforms in India, chosen deliberately over the previous dark-navy
// "premium tech" direction because it reads as more trustworthy for
// THIS audience specifically. One adjustment from the reference: the
// wordmark's accent dot uses the brand's own gold (not the reference's
// red, which appears nowhere else in PONNA's actual brand system) so
// this page stays consistent with every other page on the site. Copy
// is locked/approved content -- unchanged from here on without a
// further explicit request.

import { DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../lib/brand-theme';

const INK = '#1A2238';
const GOLD = '#A8791F';
const MUTED = '#5B6178';

function DocumentIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 3h9l4 4v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M16 3v4h4" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 14h8M9 17.5h8M9 10.5h4" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="13" cy="13" r="9.5" stroke={INK} strokeWidth="1.6" />
      <path d="M13 7.5V13l4 2.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarsIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="15" width="4" height="7" rx="1" stroke={INK} strokeWidth="1.6" />
      <rect x="11" y="10" width="4" height="12" rx="1" stroke={INK} strokeWidth="1.6" />
      <rect x="18" y="4" width="4" height="18" rx="1" stroke={INK} strokeWidth="1.6" />
    </svg>
  );
}

export default function TestYourAbilityPage() {
  return (
    <main style={{ minHeight: '100dvh', background: '#F7F7F5', color: INK, display: 'flex', flexDirection: 'column' }}>
      <BitterFontLinks />

      <header style={{ borderBottom: '1px solid #E7E5DD', padding: '18px 24px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 800, margin: 0, color: INK }}>
              PONNA<span style={{ color: GOLD }}>.in</span>
            </p>
            <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>அரசுப் போட்டித் தேர்வுக்கான பயிற்சி</p>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, maxWidth: 460, margin: '0 auto', width: '100%', padding: '40px 24px', boxSizing: 'border-box' }}>
        <p style={{ fontSize: 15, color: MUTED, margin: '0 0 10px' }}>PONNA.in-க்கு வரவேற்கிறோம்!</p>

        <h1
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.35,
            color: INK,
            margin: '0 0 18px',
          }}
        >
          அரசுப் போட்டித் தேர்வுக்கு நீங்கள் எவ்வளவு தயாராக இருக்கிறீர்கள்?
        </h1>

        <p style={{ fontSize: 15.5, lineHeight: 1.7, color: MUTED, margin: '0 0 28px' }}>
          எங்கள் கேள்விகளுக்கு பதிலளித்து, உங்கள் தயார்நிலையைத் தெரிந்துகொள்ளுங்கள்.
        </p>

        <div style={{ border: '1px solid #E7E5DD', borderRadius: 14, background: '#fff', display: 'flex', marginBottom: 28 }}>
          {[
            { icon: <DocumentIcon />, top: '20', bottom: 'கேள்விகள்' },
            { icon: <ClockIcon />, top: 'சில நிமிடங்களில்', bottom: 'முடிக்கலாம்' },
            { icon: <BarsIcon />, top: 'உங்கள் தயார்நிலையை', bottom: 'அறியலாம்' },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '20px 8px',
                borderRight: i < 2 ? '1px solid #E7E5DD' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>{item.icon}</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.4 }}>{item.top}</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.4 }}>{item.bottom}</p>
            </div>
          ))}
        </div>

        <a
          href="/ask-ponna?guestDiagnostic=1"
          style={{
            display: 'block',
            textAlign: 'center',
            width: '100%',
            padding: '18px 24px',
            borderRadius: 12,
            background: INK,
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 17,
            boxSizing: 'border-box',
            marginBottom: 18,
          }}
        >
          தொடங்குங்கள் →
        </a>

        <div style={{ textAlign: 'center' }}>
          <a href="/?skipWelcome=1" style={{ fontSize: 13.5, color: '#2851A3', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            இப்போதைக்கு வேண்டாம், Home-க்கு செல்ல
          </a>
        </div>
      </div>

      <footer style={{ borderTop: '1px solid #E7E5DD', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: FONT_FAMILY, fontSize: 15, fontWeight: 700, color: INK, margin: '0 0 4px' }}>PONNA.in</p>
        <p style={{ fontSize: 12.5, color: MUTED, margin: 0 }}>உங்கள் இலக்கு &nbsp;|&nbsp; எங்கள் துணை</p>
      </footer>
    </main>
  );
}
