import type { Metadata } from 'next';
import { COLORS, DISPLAY_FONT } from '../../lib/brand-theme';

// Public page for TNPSC teachers / channel owners (Oct 2026). Shared as a link
// in outreach messages. No sign-in, no form: the only action is a WhatsApp chat
// with a ready-typed first message. The commission is paid manually by the
// owner, and the page says so honestly.
export const metadata: Metadata = {
  title: 'Teachers | PONNA.in',
  description: 'TNPSC Group 4 ஆசிரியர்களுக்கான PONNA.in இணைப்புத் திட்டம்.',
  alternates: { canonical: '/teachers' },
};

const WA_NUMBER = '919965399896';
const FIRST_MESSAGE = 'வணக்கம், நான் TNPSC ஆசிரியர். PONNA.in-உடன் இணைய விரும்புகிறேன்';
// Fill in once the amount is decided.
const COMMISSION = '₹___';

const card: React.CSSProperties = {
  background: COLORS.card,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 12,
  padding: 18,
  marginTop: 14,
};
const h2: React.CSSProperties = { fontFamily: DISPLAY_FONT, fontSize: 19, margin: '0 0 8px', color: COLORS.ink };

export default function Page() {
  const href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(FIRST_MESSAGE)}`;
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, minHeight: '100vh', paddingBottom: 48 }}>
      <header style={{ background: COLORS.head1, borderBottom: '3px solid #E2B04A', color: '#fff', padding: '16px 16px 22px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <a href="/" style={{ display: 'block', fontSize: 13, color: '#FFE9A8', textDecoration: 'none', marginBottom: 8 }}>← PONNA.in</a>
          <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 24, lineHeight: 1.35, margin: 0, color: '#fff' }}>
            TNPSC ஆசிரியர்களே, உங்கள் மாணவர்களுடன் PONNA.in-ஐப் பகிருங்கள்
          </h1>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '4px 16px 0', lineHeight: 1.7, fontSize: 15 }}>
        <section style={card}>
          <h2 style={h2}>PONNA.in என்றால் என்ன?</h2>
          <p style={{ margin: 0 }}>
            TNPSC குரூப் 4 தேர்வுக்கான ஆன்லைன் பயிற்சித் தளம். தினசரிப் பயிற்சி, Daily Quiz, நடப்பு நிகழ்வுகள்,
            ஒவ்வொரு கேள்விக்கும் உடனடி விடை. மொபைலிலேயே பயன்படுத்தலாம். தேர்வு 10 ஜனவரி 2027.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>உங்களுக்கு என்ன கிடைக்கும்?</h2>
          <p style={{ margin: 0 }}>
            உங்கள் மூலம் வந்த ஒரு மாணவர் ₹499 PONNA Pass வாங்கினால், உங்களுக்கு <strong>{COMMISSION}</strong> கமிஷன்.
          </p>
        </section>

        <section style={card}>
          <h2 style={h2}>எப்படிச் செயல்படும்?</h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>PONNA.in பற்றி உங்கள் மாணவர்களுக்குச் சொல்லுங்கள்.</li>
            <li>அவர்கள் Pass வாங்கிய பின், உங்கள் பெயரை எங்கள் WhatsApp எண்ணுக்குத் தெரிவிக்கச் சொல்லுங்கள்.</li>
            <li>நாங்கள் சரிபார்த்து, கமிஷனை உங்களுக்கு நேரடியாக அனுப்புவோம்.</li>
          </ol>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: COLORS.inkMuted }}>
            கணக்கீடும் தொகை அனுப்புதலும் எங்களால் நேரடியாகச் செய்யப்படுகின்றன; இதற்குத் தானியங்கி அமைப்பு இல்லை.
          </p>
        </section>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            marginTop: 18, padding: '15px 18px', borderRadius: 12, background: '#25D366',
            color: '#fff', textDecoration: 'none', fontSize: 17, fontWeight: 700,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 32 32" fill="#fff" aria-hidden="true">
            <path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.55 4.18 1.6 6L4 29l8.14-1.56a12 12 0 0 0 3.9.65C22.68 28.1 28 22.7 28 16.06 28 9.4 22.68 3 16.04 3zm0 22.1c-1.2 0-2.38-.3-3.42-.9l-.5-.28-4.83.93.95-4.7-.3-.5a9.9 9.9 0 0 1-1.5-5.2c0-5.5 4.5-10 10-10s10 4.5 10 10-4.5 10.65-9.4 10.65zm5.5-7.5c-.3-.15-1.8-.9-2.08-1-.28-.1-.48-.15-.68.15-.2.3-.78 1-.95 1.2-.18.2-.35.22-.65.07-.3-.15-1.28-.47-2.43-1.5-.9-.8-1.5-1.8-1.68-2.1-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.52-.07-.15-.68-1.64-.93-2.25-.25-.6-.5-.5-.68-.5h-.58c-.2 0-.52.08-.8.38-.27.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.1 3.2 5.1 4.5.7.3 1.27.5 1.7.62.72.23 1.37.2 1.88.12.58-.08 1.8-.74 2.05-1.45.25-.7.25-1.3.18-1.45-.08-.13-.28-.2-.58-.35z" />
          </svg>
          WhatsApp-ல் தொடர்பு கொள்ளுங்கள்
        </a>
        <p style={{ textAlign: 'center', fontSize: 13, color: COLORS.inkMuted, marginTop: 10 }}>
          அல்லது எழுதுங்கள்: <a href="mailto:ponna@arlena.in" style={{ color: COLORS.gold }}>ponna@arlena.in</a>
        </p>
      </div>
    </main>
  );
}
