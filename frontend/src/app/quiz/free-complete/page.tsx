'use client';

import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        padding: '18px 18px 32px',
        background: 'linear-gradient(145deg, #f8fbff 0%, #f5f3ff 48%, #fff7ed 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,.12)', top: -100, right: -80 }} />
      <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(236,72,153,.10)', bottom: -90, left: -70 }} />

      <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 46, marginBottom: 28 }}>
          <StudentMenu />
          <div>
            <div style={{ fontSize: 19, lineHeight: 1.15, fontWeight: 800, color: '#0f172a' }}>பயிற்சி</div>
            <div style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2, color: '#64748b', fontWeight: 600 }}>Practice</div>
          </div>
        </div>

        <section
          style={{
            background: 'rgba(255,255,255,.94)',
            border: '1px solid rgba(148,163,184,.22)',
            borderRadius: 28,
            padding: '34px 28px 30px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(30,41,59,.10)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              margin: '0 auto 22px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)',
              boxShadow: '0 12px 28px rgba(124,58,237,.25)',
              color: '#fff',
              fontSize: 40,
              fontWeight: 500,
              lineHeight: 1,
            }}
          >
            ✓
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 13px',
              borderRadius: 999,
              background: '#f3e8ff',
              color: '#7c3aed',
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            5 / 5 கேள்விகள் முடிந்தது
          </div>

          <h2
            style={{
              fontSize: 27,
              lineHeight: 1.3,
              margin: '0 0 12px',
              color: '#111827',
              fontWeight: 850,
              letterSpacing: '-.3px',
            }}
          >
            இன்றைய இலவச பயிற்சி முடிந்தது
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: '#475569',
              margin: 0,
              fontWeight: 600,
            }}
          >
            5 கேள்விகளையும் முடித்துவிட்டீர்கள்.
            <br />
            பயிற்சியைத் தொடர பொன்னா பாஸ் பெறுங்கள்.
          </p>

          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, #e2e8f0, transparent)',
              margin: '26px 0 24px',
            }}
          />

          <h3
            style={{
              fontSize: 20,
              lineHeight: 1.35,
              margin: '0 0 9px',
              color: '#1e293b',
              fontWeight: 800,
            }}
          >
            Today’s free practice is complete
          </h3>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: '#64748b',
              margin: 0,
            }}
          >
            You’ve completed 5 questions.
            <br />
            Get Ponna Pass to continue practising.
          </p>

          <a
            href="/plans"
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '15px 20px',
              marginTop: 27,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 52%, #db2777 100%)',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 17,
              fontWeight: 800,
              lineHeight: 1.35,
              boxShadow: '0 10px 24px rgba(124,58,237,.24)',
            }}
          >
            <span style={{ display: 'block' }}>பொன்னா பாஸ் பெறுங்கள்</span>
            <span style={{ display: 'block', fontSize: 13, marginTop: 4, fontWeight: 600, opacity: .92 }}>Get Ponna Pass</span>
          </a>
        </section>
      </div>
    </main>
  );
}
