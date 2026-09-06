'use client';

import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, margin: 0 }}>Practice</h1>
      </div>

      <section style={{ textAlign: 'center', margin: 'auto 0', padding: '24px 8px' }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>✓</div>

        <h2 style={{ fontSize: 24, lineHeight: 1.35, margin: '0 0 10px', color: '#0f172a' }}>
          இன்றைய இலவச பயிற்சி முடிந்தது
        </h2>
        <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: '#334155', margin: '0 0 8px' }}>
          5 கேள்விகளையும் முடித்துவிட்டீர்கள். பயிற்சி தொடர Ponna Pass பெறுங்கள்.
        </p>

        <div style={{ height: 1, background: '#e2e8f0', margin: '18px auto' }} />

        <h3 style={{ fontSize: 21, lineHeight: 1.35, margin: '0 0 10px', color: '#0f172a' }}>
          Today’s free practice is complete
        </h3>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: '#64748b', margin: '0 auto 24px', maxWidth: 400 }}>
          You’ve completed 5 questions. Get Ponna Pass to continue practising.
        </p>

        <a
          href="/plans"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 10, background: '#0f172a', color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}
        >
          பொன்னா பாஸ் பெறுங்கள்
          <br />
          Get Ponna Pass
        </a>
      </section>
    </main>
  );
}
