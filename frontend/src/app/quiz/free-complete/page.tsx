'use client';

import { useLanguage } from '../../../lib/language-context';
import { StudentMenu } from '../../../components/StudentMenu';

export default function FreePracticeCompletePage() {
  const { lang } = useLanguage();

  const isTamil = lang === 'ta';
  const title = isTamil ? 'இன்றைய 5 இலவச கேள்விகள் முடிந்துவிட்டன' : "Today's 5 free questions are complete";
  const body = isTamil
    ? 'இன்றைய இலவச பயிற்சி முடிந்துவிட்டது. தொடர்ந்து பயிற்சி செய்ய உங்கள் தேர்வுக்கான Annual Plan-ஐ வாங்கலாம்.'
    : "You've completed today's free practice. Get the Annual Plan for your exam to continue practising.";
  const button = isTamil ? 'Annual Plan பார்க்கவும்' : 'View Annual Plans';
  const back = isTamil ? 'பின்னர் முயற்சி செய்யவும்' : 'Practice Again Later';

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <StudentMenu />
        <h1 style={{ fontSize: 20, margin: 0 }}>{isTamil ? 'பயிற்சி' : 'Practice'}</h1>
      </div>

      <section style={{ textAlign: 'center', margin: 'auto 0', padding: '24px 8px' }}>
        <div style={{ fontSize: 42, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 24, lineHeight: 1.35, margin: '0 0 14px', color: '#0f172a' }}>{title}</h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: '#64748b', margin: '0 auto 24px', maxWidth: 400 }}>{body}</p>

        <a
          href="/plans"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 10, background: '#0f172a', color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700, marginBottom: 10 }}
        >
          {button}
        </a>
        <a
          href="/quiz"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', color: '#0f172a', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
        >
          {back}
        </a>
      </section>
    </main>
  );
}
