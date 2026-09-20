'use client';

import { COLORS, DISPLAY_FONT as FONT_FAMILY, BitterFontLinks } from '../../../lib/brand-theme';
import { SeoPageHeader, Breadcrumb } from '../../../components/SeoPageHeader';

const SUBJECTS = [
  'Indian Polity', 'General Science', 'Geography',
  'History, Culture of India & Indian National Movement',
  'Indian Economy and Development Administration in Tamil Nadu',
  'History, Culture, Heritage & Socio-Political Movements of Tamil Nadu',
  'Aptitude & Mental Ability', 'தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு',
];

export default function Page() {
  return (
    <main style={{ background: COLORS.paper, color: COLORS.ink, paddingBottom: 60 }}>
      <BitterFontLinks />
      <SeoPageHeader />
      <Breadcrumb
        items={[
          { name: 'Home', url: '/' },
          { name: 'TNPSC Group 4', url: '/tnpsc-group-4' },
          { name: 'Question Bank', url: '/tnpsc-group-4/question-bank' },
        ]}
      />
      <section style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 30px' }}>
        <h1 style={{ fontFamily: FONT_FAMILY, fontSize: 30, fontWeight: 700, margin: '0 0 10px', lineHeight: 1.2 }}>
          TNPSC Group 4 Question Bank
        </h1>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 16 }}>
          Group 4 syllabus-ன் ஒவ்வொரு subject-க்கும் தனித்தனியாக பயிற்சி செய்யலாம் — Indian Polity, General Science, Geography முதல் தமிழ் தகுதி
          மற்றும் மதிப்பீட்டுத் தேர்வு வரை. Subject Preference தேர்ந்தெடுத்தால், அந்த subject-லிருந்து மட்டும் கேள்விகள் வரும்.
        </p>
        <p style={{ fontSize: 15.5, color: COLORS.inkMuted, lineHeight: 1.75, marginBottom: 20 }}>
          Practise each Group 4 subject on its own — pick a Subject Preference and every question you get comes only from that subject, so you can drill your
          weak areas specifically.
        </p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 24 }}>
          {SUBJECTS.map((s) => (
            <div key={s} style={{ padding: '10px 14px', border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 14 }}>{s}</div>
          ))}
        </div>
        <a
          href="/quiz"
          style={{ display: 'block', textAlign: 'center', padding: 16, borderRadius: 12, background: COLORS.ink, color: COLORS.paper, fontWeight: 700, textDecoration: 'none', fontSize: 15, marginBottom: 20 }}
        >
          Subject-வாரியாக Practice செய்யுங்கள்
        </a>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 13.5 }}>
          <a href="/tnpsc-group-4/previous-year-questions" style={{ color: COLORS.gold, textDecoration: 'underline' }}>Previous Year Questions →</a>
          <a href="/tnpsc-group-4/online-test" style={{ color: COLORS.gold, textDecoration: 'underline' }}>Online Test →</a>
          <a href="/tnpsc-group-4" style={{ color: COLORS.gold, textDecoration: 'underline' }}>TNPSC Group 4 Overview →</a>
        </div>
      </section>
    </main>
  );
}
