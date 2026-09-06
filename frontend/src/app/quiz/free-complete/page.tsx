'use client';

import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        padding: '18px 18px 32px',
        background: 'linear-gradient(145deg, #fffdf5 0%, #faf8f0 48%, #f7f3e7 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(212,175,55,.13)', top: -100, right: -80 }} />
      <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', background: 'rgba(184,134,11,.09)', bottom: -90, left: -70 }} />

      <div style={{ maxWidth: 520, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 46, marginBottom: 28 }}>
          <StudentMenu />
          <div>
            <div style={{ fontSize: 19, lineHeight: 1.15, fontWeight: 800, color: '#172033' }}>பயிற்சி</div>
            <div style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2, color: '#8a7a55', fontWeight: 600 }}>Practice</div>
          </div>
        </div>

        <section
          style={{
            background: 'rgba(255,255,255,.97)',
            border: '1px solid rgba(212,175,55,.28)',
            borderRadius: 28,
            padding: '34px 28px 30px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(120,90,20,.12)',
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
              background: 'linear-gradient(135deg, #f4d06f 0%, #d4af37 52%, #b8860b 100%)',
              boxShadow: '0 12px 28px rgba(184,134,11,.28)',
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
              padding: '7px 14px',
              borderRadius: 999,
              background: '#fff7d6',
              color: '#9a7209',
              border: '1px solid #f1df9b',
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
              color: '#5f5745',
              margin: 0,
              fontWeight: 600,
            }}
          >
            பயிற்சியைத் தொடர பொன்னா பாஸ் பெறுங்கள்.
          </p>

          <div
            style={{
              height: 1,
              background: 'linear-gradient(90deg, transparent, #eadfb9, transparent)',
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
              color: '#7b7466',
              margin: 0,
            }}
          >
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
              background: 'linear-gradient(135deg, #f4d06f 0%, #d4af37 52%, #b8860b 100%)',
              color: '#2f260e',
              textDecoration: 'none',
              fontSize: 17,
              fontWeight: 850,
              lineHeight: 1.35,
              boxShadow: '0 10px 24px rgba(184,134,11,.25)',
              border: '1px solid rgba(154,114,9,.22)',
            }}
          >
            <span style={{ display: 'block' }}>பொன்னா பாஸ் பெறுங்கள்</span>
            <span style={{ display: 'block', fontSize: 13, marginTop: 4, fontWeight: 700, opacity: .82 }}>Get Ponna Pass</span>
          </a>
        </section>
      </div>
    </main>
  );
}
