'use client';

import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        padding: '18px 18px 40px',
        background: '#fbfaf6',
        color: '#172033',
      }}
    >
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 46,
            marginBottom: 30,
          }}
        >
          <StudentMenu />
          <h1 style={{ fontSize: 20, margin: 0 }}>Practice</h1>
        </div>

        <section
          style={{
            background: '#fffefa',
            border: '1px solid #e6ddc9',
            borderRadius: 20,
            padding: '38px 34px 32px',
            textAlign: 'center',
            boxShadow: '0 16px 40px rgba(23,32,51,.06)',
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              margin: '0 auto 17px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#b8860b',
              color: '#fffefa',
              fontSize: 31,
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
              padding: '5px 12px',
              borderRadius: 999,
              background: '#f8f1df',
              color: '#947018',
              border: '1px solid #eadcb8',
              fontSize: 11,
              fontWeight: 800,
              marginBottom: 16,
            }}
          >
            5 / 5 கேள்விகள்
          </div>

          <h2
            style={{
              fontSize: 22,
              lineHeight: 1.45,
              margin: '0 0 10px',
              color: '#172033',
              fontWeight: 800,
              letterSpacing: '-.1px',
            }}
          >
            இன்றைய இலவச பயிற்சி முடிந்தது
          </h2>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: '#536078',
              margin: 0,
              fontWeight: 500,
            }}
          >
            பயிற்சியைத் தொடர பொன்னா பாஸ் பெறுங்கள்.
          </p>

          <div
            style={{
              marginTop: 25,
              paddingTop: 22,
              borderTop: '1px solid #eee6d5',
            }}
          >
            <div
              style={{
                fontSize: 18,
                lineHeight: 1.4,
                margin: '0 0 6px',
                color: '#172033',
                fontWeight: 750,
              }}
            >
              Today’s free practice is complete
            </div>

            <p
              style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: '#748096',
                margin: 0,
              }}
            >
              Get Ponna Pass to continue practising.
            </p>
          </div>

          <a
            href="/plans"
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 20px',
              marginTop: 24,
              borderRadius: 10,
              background: '#172033',
              color: '#fffefa',
              textDecoration: 'none',
              fontSize: 15,
              fontWeight: 800,
              lineHeight: 1.35,
              border: '1px solid #172033',
            }}
          >
            <span style={{ display: 'block' }}>பொன்னா பாஸ் பெறுங்கள்</span>
            <span style={{ display: 'block', fontSize: 11, marginTop: 3, color: '#d8b45a', fontWeight: 700 }}>
              Get Ponna Pass
            </span>
          </a>
        </section>
      </div>
    </main>
  );
}
