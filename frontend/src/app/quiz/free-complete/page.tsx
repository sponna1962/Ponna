'use client';

import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        padding: '18px 18px 36px',
        background: '#fbfaf6',
        color: '#172033',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            height: 46,
            marginBottom: 34,
          }}
        >
          <StudentMenu />
          <div>
            <div style={{ fontSize: 19, lineHeight: 1.15, fontWeight: 800, color: '#172033' }}>
              பயிற்சி
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.2, marginTop: 2, color: '#a87917', fontWeight: 600 }}>
              Practice
            </div>
          </div>
        </div>

        <section
          style={{
            background: '#fffefa',
            border: '1px solid #e8dfca',
            borderRadius: 22,
            padding: '42px 30px 34px',
            textAlign: 'center',
            boxShadow: '0 12px 35px rgba(23,32,51,.07)',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              margin: '0 auto 20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#b8860b',
              color: '#fffefa',
              fontSize: 36,
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
              padding: '6px 13px',
              borderRadius: 999,
              background: '#f7efd8',
              color: '#9a6f14',
              border: '1px solid #ead9aa',
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 18,
            }}
          >
            5 / 5 கேள்விகள்
          </div>

          <h2
            style={{
              fontSize: 28,
              lineHeight: 1.3,
              margin: '0 0 12px',
              color: '#172033',
              fontWeight: 850,
              letterSpacing: '-.3px',
            }}
          >
            இன்றைய இலவச பயிற்சி முடிந்தது
          </h2>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: '#43506a',
              margin: 0,
              fontWeight: 600,
            }}
          >
            பயிற்சியைத் தொடர பொன்னா பாஸ் பெறுங்கள்.
          </p>

          <div
            style={{
              height: 1,
              background: '#e8dfca',
              margin: '28px 0 25px',
            }}
          />

          <h3
            style={{
              fontSize: 21,
              lineHeight: 1.35,
              margin: '0 0 9px',
              color: '#172033',
              fontWeight: 800,
            }}
          >
            Today’s free practice is complete
          </h3>

          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: '#69758a',
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
              padding: '16px 20px',
              marginTop: 28,
              borderRadius: 11,
              background: '#172033',
              color: '#fffefa',
              textDecoration: 'none',
              fontSize: 17,
              fontWeight: 800,
              lineHeight: 1.35,
              border: '1px solid #172033',
            }}
          >
            <span style={{ display: 'block' }}>பொன்னா பாஸ் பெறுங்கள்</span>
            <span style={{ display: 'block', fontSize: 13, marginTop: 4, color: '#d8b45a', fontWeight: 700 }}>
              Get Ponna Pass
            </span>
          </a>
        </section>
      </div>
    </main>
  );
}
