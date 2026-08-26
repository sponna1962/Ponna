'use client';

// Home — the post-login landing page. No language selection here at all
// (finalized requirement): the Homepage itself always shows both Tamil and
// English together, and language becomes a student choice only inside
// Practice Preference Setup.
//
// "Start Practising" ALWAYS goes to /quiz (finalized requirement — no
// silent skip-straight-to-questions from here, even for a returning
// student with a saved preference). /quiz itself decides what to show:
// the full Setup form for a first-time student, or a Preferences summary
// + "Start Practice" button for a returning one — so the student always
// sees and confirms what they're about to practice before it starts.

import { StudentMenu } from '../../components/StudentMenu';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <StudentMenu />
        <strong style={{ fontSize: 16 }}>PONNA.in</strong>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, marginBottom: 4, whiteSpace: 'pre-line' }}>
          வெற்றியின்{'\n'}முதல் படி.
        </h1>
        <h1 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, marginBottom: 16, whiteSpace: 'pre-line', color: '#334155' }}>
          The first step{'\n'}to success.
        </h1>

        <p style={{ fontSize: 15, color: '#475569', marginBottom: 4, lineHeight: 1.5 }}>
          போட்டித் தேர்வுகளுக்கு தயாராகும் மாணவர்களுக்கான பயிற்சி இணையதளம்.
        </p>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32, lineHeight: 1.5 }}>
          A practice platform for competitive exam aspirants.
        </p>

        <a
          href="/quiz"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: 16,
            borderRadius: 12,
            background: '#0f172a',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          பயிற்சியைத் தொடங்குங்கள் / Start Practising
        </a>
      </div>
    </main>
  );
}
