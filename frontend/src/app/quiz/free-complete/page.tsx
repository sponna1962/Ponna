'use client';

import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        minHeight: '100dvh',
        padding: '20px 20px 28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, margin: 0 }}>Practice</h1>
      </div>

      <section
        style={{
          textAlign: 'center',
          margin: 'auto 0',
          padding: '20px 0 8px',
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1, marginBottom: 24 }}>✓</div>

        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 25,
              lineHeight: 1.35,
              margin: '0 0 14px',
              color: '#0f172a',
              fontWeight: 800,
            }}
          >
            இன்றைய இலவச பயிற்சி முடிந்தது
          </h2>
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.65,
              color: '#334155',
              margin: 0,
            }}
          >
            5 கேள்விகளையும் முடித்துவிட்டீர்கள்.
            <br />
            பயிற்சியைத் தொடர பொன்னா பாஸ் பெறுங்கள்.
          </p>

          <div style={{ height: 1, background: '#e2e8f0', margin: '24px 0' }} />

          <h3
            style={{
              fontSize: 21,
              lineHeight: 1.4,
              margin: '0 0 12px',
              color: '#0f172a',
              fontWeight: 800,
            }}
          >
            Today’s free practice is complete
          </h3>
          <p
            style={{
              fontSize: 15,
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
              padding: '13px 18px',
              marginTop: 28,
              borderRadius: 10,
              background: '#0f172a',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            <span style={{ display: 'block' }}>பொன்னா பாஸ் பெறுங்கள்</span>
            <span style={{ display: 'block', fontSize: 14, marginTop: 2, fontWeight: 600 }}>Get Ponna Pass</span>
          </a>
        </div>
      </section>
    </main>
  );
}
